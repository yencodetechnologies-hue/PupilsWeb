import { col, getInstById, getMemberById, publicMember } from "./db.js";
import { notifyAdmin, notifyAllMembers, notifyMember } from "./notify.js";
import { applyVisibility } from "./visibility.js";
import { HttpError, makeId, text, wrap } from "./util.js";

const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const WORK_MODES = ["On-site", "Hybrid", "Remote"];

const clean = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

const brief = (row, viewer) => {
  const view = applyVisibility(publicMember(row), viewer);
  return {
    id: view.id,
    name: view.name,
    photo: view.photo || "",
    batch: view.batch,
    yearCompleted: view.yearCompleted,
    city: view.city || "",
    occupation: view.occupation || view.currentJob?.designation || "",
    company: view.currentJob?.orgName || "",
  };
};

function cleanJob(body) {
  const title = text(body?.title, 120);
  const company = text(body?.company, 120);
  if (!title) throw new HttpError(400, "Enter the job title.");
  if (!company) throw new HttpError(400, "Enter the company name.");
  return {
    title,
    company,
    location: text(body?.location, 120),
    type: JOB_TYPES.includes(body?.type) ? body.type : JOB_TYPES[0],
    mode: WORK_MODES.includes(body?.mode) ? body.mode : WORK_MODES[0],
    salary: text(body?.salary, 60),
    experience: text(body?.experience, 60),
    description: text(body?.description, 3000),
    link: text(body?.link, 300),
  };
}

async function jobsFor(instId, viewerMemberId) {
  const jobs = (await col("jobs").find({ instId }).sort({ createdAt: -1 }).toArray()).map(clean);
  const apps = await col("applications").find({ instId }).toArray();
  return jobs.map((job) => {
    const mine = apps.filter((item) => item.jobId === job.id);
    return {
      ...job,
      applicants: mine.length,
      applied: viewerMemberId ? mine.some((item) => item.memberId === viewerMemberId) : false,
      isOwner: viewerMemberId ? job.postedBy?.id === viewerMemberId : false,
    };
  });
}

async function applicantsOf(job) {
  const apps = (await col("applications").find({ jobId: job.id }).sort({ createdAt: -1 }).toArray()).map(clean);
  const out = [];
  for (const item of apps) {
    const row = await getMemberById(item.memberId);
    if (!row) continue;
    out.push({
      id: item.id,
      note: item.note,
      createdAt: item.createdAt,
      member: {
        id: row.id,
        name: row.name,
        photo: row.photo || "",
        email: row.email,
        mobile: row.mobile,
        city: row.city || "",
        yearCompleted: row.yearCompleted || row.batch,
      },
    });
  }
  return out;
}

export function mountNetwork(app, { admin, memberOnly }) {
  // ---------- connections (member) ----------
  const links = () => col("connections");

  app.get("/api/me/network", memberOnly, wrap(async (req, res) => {
    const me = req.member;
    const rows = (await links().find({ $or: [{ from: me.id }, { to: me.id }] }).toArray()).map(clean);
    const otherIds = [...new Set(rows.map((item) => (item.from === me.id ? item.to : item.from)))];
    const people = new Map();
    for (const id of otherIds) {
      const row = await getMemberById(id);
      if (row && row.instId === me.instId) people.set(id, brief(row, me));
    }
    const pack = (item) => ({ id: item.id, createdAt: item.createdAt, member: people.get(item.from === me.id ? item.to : item.from) });
    const known = rows.filter((item) => people.has(item.from === me.id ? item.to : item.from));
    res.json({
      connections: known.filter((item) => item.status === "accepted").map(pack),
      incoming: known.filter((item) => item.status === "pending" && item.to === me.id).map(pack),
      outgoing: known.filter((item) => item.status === "pending" && item.from === me.id).map(pack),
    });
  }));

  app.post("/api/me/connections", memberOnly, wrap(async (req, res) => {
    const me = req.member;
    const to = text(req.body?.to, 80);
    const other = to ? await getMemberById(to) : null;
    if (!other || other.instId !== me.instId || other.id === me.id) throw new HttpError(404, "That person was not found.");
    const existing = await links().findOne({
      $or: [{ from: me.id, to: other.id }, { from: other.id, to: me.id }],
    });
    if (existing) {
      if (existing.status === "pending" && existing.to === me.id) {
        await links().updateOne({ id: existing.id }, { $set: { status: "accepted", acceptedAt: Date.now() } });
        notifyMember(other, { type: "connected", text: `${me.name} accepted your connection`, view: "friends" });
      }
      return res.json({ ok: true });
    }
    await links().insertOne({ id: makeId(), instId: me.instId, from: me.id, to: other.id, status: "pending", createdAt: Date.now() });
    notifyMember(other, { type: "request", text: `${me.name} wants to connect with you`, view: "friends" });
    res.status(201).json({ ok: true });
  }));

  app.post("/api/me/connections/:id/accept", memberOnly, wrap(async (req, res) => {
    const item = await links().findOne({ id: req.params.id, to: req.member.id, status: "pending" });
    if (!item) throw new HttpError(404, "That request was not found.");
    await links().updateOne({ id: item.id }, { $set: { status: "accepted", acceptedAt: Date.now() } });
    notifyMember(await getMemberById(item.from), { type: "connected", text: `${req.member.name} accepted your connection`, view: "friends" });
    res.json({ ok: true });
  }));

  // decline, withdraw or remove a connection
  app.delete("/api/me/connections/:id", memberOnly, wrap(async (req, res) => {
    const me = req.member.id;
    const done = await links().deleteOne({ id: req.params.id, $or: [{ from: me }, { to: me }] });
    if (!done.deletedCount) throw new HttpError(404, "That connection was not found.");
    res.json({ ok: true });
  }));

  // ---------- jobs ----------
  const jobOf = async (id, instId) => {
    const job = clean(await col("jobs").findOne({ id }));
    if (!job || job.instId !== instId) throw new HttpError(404, "That job was not found.");
    return job;
  };

  app.get("/api/jobs", admin, wrap(async (req, res) => {
    res.json({ jobs: await jobsFor(req.inst.id, null) });
  }));

  app.post("/api/jobs", admin, wrap(async (req, res) => {
    const job = {
      id: makeId(), instId: req.inst.id, ...cleanJob(req.body), closed: false, createdAt: Date.now(),
      postedBy: { kind: "admin", id: req.inst.id, name: req.inst.name },
    };
    await col("jobs").insertOne(job);
    notifyAllMembers(job.instId, null, { type: "job", text: `New job: ${job.title} at ${job.company}`, view: "jobs" });
    res.status(201).json({ ok: true });
  }));

  app.patch("/api/jobs/:id", admin, wrap(async (req, res) => {
    const job = await jobOf(req.params.id, req.inst.id);
    const fields = req.body?.closed !== undefined ? { closed: !!req.body.closed } : cleanJob(req.body);
    await col("jobs").updateOne({ id: job.id }, { $set: fields });
    res.json({ ok: true });
  }));

  app.delete("/api/jobs/:id", admin, wrap(async (req, res) => {
    const job = await jobOf(req.params.id, req.inst.id);
    await col("jobs").deleteOne({ id: job.id });
    await col("applications").deleteMany({ jobId: job.id });
    res.json({ ok: true });
  }));

  app.get("/api/jobs/:id/applicants", admin, wrap(async (req, res) => {
    res.json({ applicants: await applicantsOf(await jobOf(req.params.id, req.inst.id)) });
  }));

  app.get("/api/me/jobs", memberOnly, wrap(async (req, res) => {
    res.json({ jobs: await jobsFor(req.member.instId, req.member.id) });
  }));

  app.post("/api/me/jobs", memberOnly, wrap(async (req, res) => {
    const job = {
      id: makeId(), instId: req.member.instId, ...cleanJob(req.body), closed: false, createdAt: Date.now(),
      postedBy: { kind: "member", id: req.member.id, name: req.member.name },
    };
    await col("jobs").insertOne(job);
    notifyAllMembers(job.instId, req.member.id, { type: "job", text: `New job: ${job.title} at ${job.company}`, view: "jobs" });
    res.status(201).json({ ok: true });
  }));

  const ownJob = async (req) => {
    const job = await jobOf(req.params.id, req.member.instId);
    if (job.postedBy?.id !== req.member.id) throw new HttpError(403, "Only the person who posted this job can change it.");
    return job;
  };

  app.patch("/api/me/jobs/:id", memberOnly, wrap(async (req, res) => {
    const job = await ownJob(req);
    const fields = req.body?.closed !== undefined ? { closed: !!req.body.closed } : cleanJob(req.body);
    await col("jobs").updateOne({ id: job.id }, { $set: fields });
    res.json({ ok: true });
  }));

  app.delete("/api/me/jobs/:id", memberOnly, wrap(async (req, res) => {
    const job = await ownJob(req);
    await col("jobs").deleteOne({ id: job.id });
    await col("applications").deleteMany({ jobId: job.id });
    res.json({ ok: true });
  }));

  app.get("/api/me/jobs/:id/applicants", memberOnly, wrap(async (req, res) => {
    res.json({ applicants: await applicantsOf(await ownJob(req)) });
  }));

  app.post("/api/me/jobs/:id/apply", memberOnly, wrap(async (req, res) => {
    const job = await jobOf(req.params.id, req.member.instId);
    if (job.closed) throw new HttpError(400, "This job is closed.");
    if (job.postedBy?.id === req.member.id) throw new HttpError(400, "You posted this job.");
    if (await col("applications").findOne({ jobId: job.id, memberId: req.member.id })) {
      throw new HttpError(400, "You already applied.");
    }
    await col("applications").insertOne({
      id: makeId(), jobId: job.id, instId: job.instId, memberId: req.member.id,
      note: text(req.body?.note, 600), createdAt: Date.now(),
    });
    const message = { type: "application", text: `${req.member.name} applied for ${job.title}`, view: "jobs" };
    if (job.postedBy?.kind === "admin") notifyAdmin(await getInstById(job.instId), message);
    else notifyMember(await getMemberById(job.postedBy?.id), message);
    res.status(201).json({ ok: true });
  }));
}
