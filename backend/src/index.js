import "./env.js";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express from "express";
import multer from "multer";
import { acceptPhoto, removePhoto, uploadProfilePhoto } from "./media.js";
import {
  countInBatch,
  deleteMember,
  emailTaken,
  findByEmail,
  findByMobile,
  getInstByCode,
  getInstById,
  getMemberById,
  insertInstitution,
  insertMember,
  memberNoTaken,
  membersFor,
  mobileTaken,
  nextMemberNo,
  publicInst,
  publicMember,
  saveMemberPhoto,
  saveBatches,
  saveCode,
  saveAdminAccount,
  saveInstitutionProfile,
  savePassword,
  updateMemberProfile,
  connectDb,
  saveOtp,
  getOtp,
  markOtpVerified,
  deleteOtp,
  batchmates,
} from "./db.js";
import { sendOtp } from "./mail.js";
import {
  BLOOD,
  GENDERS,
  HttpError,
  MARITAL,
  TYPES,
  addressLine,
  ageFromDob,
  cleanAddress,
  cleanAge,
  cleanJob,
  cleanKidsCount,
  cleanList,
  cleanSiblings,
  cleanStudy,
  clearCookieOpts,
  cookieOpts,
  fmtDate,
  hashOtp,
  isEmail,
  isMobile,
  makeCode,
  makeId,
  newOtp,
  normMobile,
  readToken,
  safeEqual,
  signToken,
  text,
  validYear,
  wrap,
} from "./util.js";

const FRONTEND_ORIGINS = new Set([
  "https://pupils-web.vercel.app",
  "https://pupilsweb.in",
  "https://www.pupilsweb.in",
  "https://pupilsweb.com",
  "https://www.pupilsweb.com",
  "http://localhost:5173",
]);

const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && FRONTEND_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Use a JPG, PNG, or WebP image."));
  },
});

app.post("/api/media/photo", (req, res, next) => {
  photoUpload.single("photo")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return next(new HttpError(400, "Image must be 2 MB or smaller."));
    return next(error);
  });
}, wrap(async (req, res) => {
  if (!req.file) throw new HttpError(400, "Choose a profile picture.");
  const uploaded = await uploadProfilePhoto(req.file.buffer);
  const session = sessionOf(req);
  if (req.body?.save === "1" && session?.kind === "member") {
    const member = await getMemberById(session.id);
    if (member) {
      await saveMemberPhoto(member.id, uploaded.photo, uploaded.photoId);
      if (member.photoId && member.photoId !== uploaded.photoId) await removePhoto(member.photoId);
      return res.json({ ...uploaded, member: publicMember(await getMemberById(member.id)) });
    }
  }
  res.json(uploaded);
}));

function sessionOf(req) {
  const token = req.cookies?.ac_token;
  if (!token) return null;
  try {
    return readToken(token);
  } catch {
    return null;
  }
}

function requireUser(kind) {
  return wrap(async (req, res, next) => {
    const session = sessionOf(req);
    if (!session) return res.status(401).json({ error: "Sign in to continue." });
    if (session.kind !== kind) return res.status(403).json({ error: "You don't have access to that page." });
    if (kind === "admin") {
      const inst = await getInstById(session.id);
      if (!inst) return res.status(401).json({ error: "Sign in to continue." });
      req.inst = inst;
    } else {
      const member = await getMemberById(session.id);
      if (!member) return res.status(401).json({ error: "Sign in to continue." });
      req.member = member;
    }
    next();
  });
}

function setSession(res, kind, id) {
  res.cookie("ac_token", signToken({ kind, id }), cookieOpts);
}

async function accountPayload(kind, row) {
  if (kind === "admin") return { kind, institution: publicInst(row) };
  const inst = await getInstById(row.instId);
  return {
    kind,
    member: publicMember(row),
    institution: inst
      ? { id: inst.id, name: inst.name, type: inst.type, code: inst.code }
      : null,
  };
}

function assertPassword(pw) {
  const password = String(pw ?? "");
  if (password.length < 6) throw new HttpError(400, "Password must be at least 6 characters.");
  if (password.length > 200) throw new HttpError(400, "Password is too long.");
  return password;
}

function yearsFromBody(body) {
  if (Array.isArray(body.years)) return body.years.map(Number);
  const from = Number(body.from);
  const to = Number(body.to);
  if (!from || !to || from > to || to - from > 80) {
    throw new HttpError(400, "Enter a valid range, like 2001 to 2010.");
  }
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", wrap(async (req, res) => {
  const type = TYPES.includes(req.body?.type) ? req.body.type : "";
  const name = text(req.body?.name, 80);
  const instName = text(req.body?.inst, 120);
  const email = text(req.body?.email, 160).toLowerCase();
  const mobile = normMobile(req.body?.mobile);
  const password = assertPassword(req.body?.pw);

  if (!type) throw new HttpError(400, "Choose School, College, or Other.");
  if (!instName || !name) throw new HttpError(400, "Enter the institution name and your name.");
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email ID.");
  if (!isMobile(mobile)) throw new HttpError(400, "Enter a valid 10-digit mobile number.");
  if (await emailTaken(email)) throw new HttpError(400, "An account with this email already exists. Sign in instead.");
  if (await mobileTaken(mobile)) throw new HttpError(400, "This mobile number is already registered.");

  const row = {
    id: makeId(),
    code: makeCode(),
    type,
    name: instName,
    adminName: name,
    adminEmail: email,
    adminMobile: mobile,
    passwordHash: await bcrypt.hash(password, 10),
    batches: [],
    createdAt: Date.now(),
  };
  await insertInstitution(row);
  const saved = await getInstById(row.id);
  setSession(res, "admin", saved.id);
  res.status(201).json(await accountPayload("admin", saved));
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const id = text(req.body?.id, 160);
  const password = String(req.body?.pw ?? "");
  if (!id || !password) throw new HttpError(400, "Enter your email or mobile number and password.");

  const account = isEmail(id) ? await findByEmail(id) : isMobile(id) ? await findByMobile(normMobile(id)) : null;
  if (!account) throw new HttpError(400, `No account found for ${id}. Check it or create an account.`);
  const ok = await bcrypt.compare(password, account.row.passwordHash);
  if (!ok) throw new HttpError(400, "That password is incorrect.");
  setSession(res, account.kind, account.row.id);
  res.json(await accountPayload(account.kind, account.row));
}));

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("ac_token", clearCookieOpts);
  res.json({ ok: true });
});

app.get("/api/auth/me", wrap(async (req, res) => {
  const session = sessionOf(req);
  if (!session) throw new HttpError(401, "Sign in to continue.");
  if (session.kind === "admin") {
    const inst = await getInstById(session.id);
    if (!inst) throw new HttpError(401, "Sign in to continue.");
    return res.json(await accountPayload("admin", inst));
  }
  const member = await getMemberById(session.id);
  if (!member) throw new HttpError(401, "Sign in to continue.");
  res.json(await accountPayload("member", member));
}));

app.post("/api/auth/forgot", wrap(async (req, res) => {
  const email = text(req.body?.email, 160).toLowerCase();
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email ID.");
  const account = await findByEmail(email);
  if (!account) throw new HttpError(400, "No account uses this email.");

  const code = newOtp();
  await saveOtp({
    email,
    codeHash: hashOtp(code),
    expiresAt: Date.now() + 10 * 60 * 1000,
    kind: account.kind,
    accountId: account.row.id,
  });

  const delivery = await sendOtp(email, code);
  res.json({ ok: true, emailed: delivery.emailed });
}));

app.post("/api/auth/verify-otp", wrap(async (req, res) => {
  const email = text(req.body?.email, 160).toLowerCase();
  const code = text(req.body?.code, 6);
  const row = await getOtp(email);
  if (!row || Date.now() > Number(row.expiresAt)) {
    throw new HttpError(400, "This code has expired. Send a new one.");
  }
  if (!safeEqual(row.codeHash, hashOtp(code))) {
    throw new HttpError(400, "That code doesn't match. Check and try again.");
  }
  await markOtpVerified(email);
  res.json({ ok: true });
}));

app.post("/api/auth/reset", wrap(async (req, res) => {
  const email = text(req.body?.email, 160).toLowerCase();
  const password = assertPassword(req.body?.password);
  const row = await getOtp(email);
  if (!row || !row.verified || Date.now() > Number(row.expiresAt)) {
    throw new HttpError(400, "Verify the code first.");
  }
  await savePassword(row.kind, row.accountId, await bcrypt.hash(password, 10));
  await deleteOtp(email);
  res.json({ ok: true });
}));

const admin = requireUser("admin");

app.get("/api/institution", admin, (req, res) => {
  res.json({ institution: publicInst(req.inst) });
});

app.patch("/api/institution", admin, wrap(async (req, res) => {
  const name = text(req.body?.name, 120);
  const type = TYPES.includes(req.body?.type) ? req.body.type : req.inst.type;
  if (!name) throw new HttpError(400, "Enter the institution name.");
  await saveInstitutionProfile(req.inst.id, name, type);
  res.json({ institution: publicInst(await getInstById(req.inst.id)) });
}));

app.patch("/api/account", admin, wrap(async (req, res) => {
  const name = text(req.body?.name, 80);
  const instName = text(req.body?.inst, 120);
  const email = text(req.body?.email, 160).toLowerCase();
  const mobile = normMobile(req.body?.mobile);
  const type = TYPES.includes(req.body?.type) ? req.body.type : req.inst.type;
  if (!name) throw new HttpError(400, "Enter your name.");
  if (!instName) throw new HttpError(400, "Enter the institution name.");
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email ID.");
  if (!isMobile(mobile)) throw new HttpError(400, "Enter a valid 10-digit mobile number.");
  if (await emailTaken(email, req.inst.id, "admin")) throw new HttpError(400, "This email is already registered.");
  if (await mobileTaken(mobile, req.inst.id, "admin")) throw new HttpError(400, "This mobile number is already registered.");

  const fields = {
    adminName: name,
    adminEmail: email,
    adminMobile: mobile,
    name: instName,
    type,
  };
  const nextPassword = String(req.body?.pw ?? "");
  if (nextPassword) {
    const current = String(req.body?.currentPw ?? "");
    const ok = await bcrypt.compare(current, req.inst.passwordHash);
    if (!ok) throw new HttpError(400, "Current password is incorrect.");
    fields.passwordHash = await bcrypt.hash(assertPassword(nextPassword), 10);
  }
  await saveAdminAccount(req.inst.id, fields);
  res.json({ institution: publicInst(await getInstById(req.inst.id)) });
}));

app.post("/api/batches", admin, wrap(async (req, res) => {
  const current = publicInst(req.inst).batches;
  const incoming = yearsFromBody(req.body || {});
  const fresh = [...new Set(incoming)].filter((year) => validYear(year) && !current.includes(year));
  if (!fresh.length) throw new HttpError(400, "Those batches already exist or are out of range.");
  const batches = [...current, ...fresh].sort((a, b) => a - b);
  await saveBatches(req.inst.id, batches);
  res.json({ institution: publicInst(await getInstById(req.inst.id)), added: fresh });
}));

app.delete("/api/batches/:year", admin, wrap(async (req, res) => {
  const year = Number(req.params.year);
  const current = publicInst(req.inst).batches;
  if (!current.includes(year)) throw new HttpError(404, "That batch was not found.");
  if (await countInBatch(req.inst.id, year)) {
    throw new HttpError(400, `Batch ${year} has alumni and can't be removed.`);
  }
  await saveBatches(req.inst.id, current.filter((item) => item !== year));
  res.json({ institution: publicInst(await getInstById(req.inst.id)) });
}));

app.post("/api/institution/code", admin, wrap(async (req, res) => {
  let code = makeCode();
  for (let i = 0; i < 5 && await getInstByCode(code); i += 1) code = makeCode();
  await saveCode(req.inst.id, code);
  res.json({ institution: publicInst(await getInstById(req.inst.id)) });
}));

app.get("/api/members", admin, wrap(async (req, res) => {
  res.json({ members: await membersFor(req.inst.id) });
}));

app.patch("/api/members/:id", admin, wrap(async (req, res) => {
  const row = await getMemberById(req.params.id);
  if (!row || row.instId !== req.inst.id) throw new HttpError(404, "That alumni record was not found.");
  const action = req.body?.action;
  if (action === "reject") {
    await updateMemberProfile(row.id, { identityRequest: null });
    return res.json({ member: publicMember(await getMemberById(row.id)) });
  }
  const source = action === "approve" ? row.identityRequest : req.body;
  if (action === "approve" && !source?.name) throw new HttpError(400, "There is no update waiting for approval.");
  const next = await identityFields(source || {}, row.id);
  await updateMemberProfile(row.id, { ...next, identityRequest: null });
  res.json({ member: publicMember(await getMemberById(row.id)) });
}));

app.delete("/api/members/:id", admin, wrap(async (req, res) => {
  const row = await getMemberById(req.params.id);
  if (!row || row.instId !== req.inst.id) return res.status(404).json({ error: "That alumni record was not found." });
  const changes = await deleteMember(req.params.id, req.inst.id);
  if (!changes) return res.status(404).json({ error: "That alumni record was not found." });
  await removePhoto(row.photoId);
  res.json({ ok: true });
}));

function profileDetails(body) {
  const dob = text(body.dob, 20);
  const curAddress = cleanAddress(body.curAddress);
  const nativeAddress = cleanAddress(body.nativeAddress);
  const currentJob = cleanJob(body.currentJob);
  const previousJob = cleanJob(body.previousJob);
  return {
    yearCompleted: text(body.yearCompleted, 10),
    classLeaving: text(body.classLeaving, 40),
    age: ageFromDob(dob) || cleanAge(body.age),
    dob,
    gender: GENDERS.includes(body.gender) ? body.gender : "",
    blood: BLOOD.includes(body.blood) ? body.blood : "",
    father: text(body.father, 80),
    fatherOccupation: text(body.fatherOccupation, 120),
    fatherCompany: text(body.fatherCompany, 160),
    mother: text(body.mother, 80),
    motherOccupation: text(body.motherOccupation, 120),
    motherCompany: text(body.motherCompany, 160),
    curAddress,
    nativeAddress,
    curAddr: addressLine(curAddress),
    nativeAddr: addressLine(nativeAddress),
    city: text(curAddress.district, 80),
    siblings: cleanSiblings(body.siblings),
    otherSchools: cleanList(body.otherSchools, ["name", "yearCompleted", "classLeaving"], 8),
    currentJob,
    previousJob,
    collegeUg: cleanStudy(body.collegeUg),
    collegePg: cleanStudy(body.collegePg),
    occupation: text(currentJob.designation, 120),
    maritalStatus: MARITAL.includes(body.maritalStatus) ? body.maritalStatus : "",
    spouseName: text(body.spouseName, 80),
    spouseOccupation: text(body.spouseOccupation, 120),
    spouseCompany: text(body.spouseCompany, 160),
    kidsCount: cleanKidsCount(body.kidsCount),
    kids: cleanList(body.kids, ["name", "dob", "school", "classYear"], 4),
  };
}

function jobCell(job) {
  return [job?.orgName, job?.designation, job?.orgType, job?.contact].filter(Boolean).join(" · ");
}

function studyCell(study) {
  return [study?.name, study?.year, study?.department].filter(Boolean).join(" · ");
}

app.get("/api/members/export.csv", admin, wrap(async (req, res) => {
  const inst = publicInst(req.inst);
  const members = (await membersFor(req.inst.id)).sort((a, b) => a.batch - b.batch || a.name.localeCompare(b.name));
  const q = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const headers = [
    "memberNo", "yearJoined", "yearCompleted", "classLeaving", "name", "age", "gender", "dob", "mobile", "blood", "email",
    "currentAddress", "nativeAddress", "city",
    "father", "fatherOccupation", "fatherCompany", "mother", "motherOccupation", "motherCompany",
    "siblings", "otherSchools", "currentJob", "previousJob", "collegeUg", "collegePg",
    "maritalStatus", "spouseName", "spouseOccupation", "spouseCompany", "kidsCount", "kids", "joined",
  ];
  const lines = [
    headers.join(","),
    ...members.map((member) => [
      member.memberNo,
      member.batch,
      member.yearCompleted,
      member.classLeaving,
      member.name,
      member.age,
      member.gender,
      member.dob,
      member.mobile,
      member.blood,
      member.email,
      addressLine(member.curAddress) || member.curAddr,
      addressLine(member.nativeAddress) || member.nativeAddr,
      member.city,
      member.father,
      member.fatherOccupation,
      member.fatherCompany,
      member.mother,
      member.motherOccupation,
      member.motherCompany,
      (member.siblings || []).map((item) => [item.name, item.gender, item.dob, item.org, item.alumniId].filter(Boolean).join(" · ")).join("; "),
      (member.otherSchools || []).map((item) => [item.name, item.yearCompleted, item.classLeaving].filter(Boolean).join(" · ")).join("; ")
        || (member.schools || []).map((item) => item.name).join("; "),
      jobCell(member.currentJob) || (member.businesses || []).map((item) => item.name).join("; "),
      jobCell(member.previousJob),
      studyCell(member.collegeUg) || (member.colleges || []).map((item) => item.name).join("; "),
      studyCell(member.collegePg),
      member.maritalStatus,
      member.spouseName,
      member.spouseOccupation,
      member.spouseCompany,
      member.kidsCount,
      (member.kids || []).map((item) => [item.name, item.dob, item.school, item.classYear].filter(Boolean).join(" · ")).join("; "),
      fmtDate(member.joinedAt),
    ].map(q).join(",")),
  ];
  const filename = `${inst.name.replace(/[^\w]+/g, "-")}-alumni.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\uFEFF${lines.join("\n")}`);
}));

app.get("/api/join/:code", wrap(async (req, res) => {
  const inst = await getInstByCode(req.params.code);
  if (!inst) throw new HttpError(404, "This link isn't active.");
  const pub = publicInst(inst);
  res.json({
    institution: { id: pub.id, name: pub.name, type: pub.type, code: pub.code, batches: pub.batches },
  });
}));

app.post("/api/join/:code", wrap(async (req, res) => {
  const inst = await getInstByCode(req.params.code);
  if (!inst) throw new HttpError(404, "This link isn't active.");
  const pub = publicInst(inst);
  const body = req.body || {};
  const batch = Number(body.batch);
  const name = text(body.name, 80);
  const email = text(body.email, 160).toLowerCase();
  const mobile = normMobile(body.mobile);
  const password = assertPassword(body.pw);
  const details = profileDetails(body);
  const picture = body.photo || body.photoId ? acceptPhoto(body.photo, body.photoId) : { photo: "", photoId: "" };
  let memberNo = text(body.memberNo, 40);
  if (!memberNo) memberNo = await nextMemberNo(inst.id);

  if (!pub.batches.includes(batch)) throw new HttpError(400, "Select your batch.");
  if (!name) throw new HttpError(400, "Enter your full name.");
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email ID.");
  if (!isMobile(mobile)) throw new HttpError(400, "Enter a valid 10-digit mobile number.");
  if (await emailTaken(email)) throw new HttpError(400, "This email is already registered. Sign in instead.");
  if (await mobileTaken(mobile)) throw new HttpError(400, "This mobile number is already registered.");
  if (await memberNoTaken(inst.id, memberNo)) throw new HttpError(400, "This alumni member number is already used.");

  const row = {
    id: makeId(),
    instId: inst.id,
    memberNo,
    batch,
    name,
    email,
    mobile,
    passwordHash: await bcrypt.hash(password, 10),
    ...details,
    schools: [],
    colleges: [],
    businesses: [],
    links: [],
    photo: picture.photo,
    photoId: picture.photoId,
    joinedAt: Date.now(),
  };
  await insertMember(row);
  res.status(201).json({ member: publicMember(await getMemberById(row.id)) });
}));

const memberOnly = requireUser("member");

app.get("/api/me/batchmates", memberOnly, wrap(async (req, res) => {
  const mates = await batchmates(req.member.instId, req.member.batch, req.member.id);
  res.json({ batchmates: mates });
}));

app.patch("/api/me", memberOnly, wrap(async (req, res) => {
  const body = req.body || {};
  const fields = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (has("batch")) {
    const inst = await getInstById(req.member.instId);
    const batch = Number(body.batch);
    const years = publicInst(inst)?.batches || [];
    if (!years.includes(batch)) throw new HttpError(400, "Select your batch.");
    fields.batch = batch;
  }
  if (has("memberNo") || has("curAddress")) {
    let memberNo = text(body.memberNo, 40);
    if (!memberNo) memberNo = req.member.memberNo || await nextMemberNo(req.member.instId);
    if (await memberNoTaken(req.member.instId, memberNo, req.member.id)) {
      throw new HttpError(400, "This alumni member number is already used.");
    }
    fields.memberNo = memberNo;
  }
  if (has("curAddress") || has("father") || has("currentJob") || has("siblings") || has("kids")) {
    const details = profileDetails(body);
    if (has("father") && !details.father) throw new HttpError(400, "Enter your father's name.");
    if (has("mother") && !details.mother) throw new HttpError(400, "Enter your mother's name.");
    if (!details.curAddr) delete details.curAddr;
    if (!details.nativeAddr) delete details.nativeAddr;
    if (!details.city) delete details.city;
    if (!details.occupation) delete details.occupation;
    Object.assign(fields, details);
  }

  let replacedId = "";
  if (has("photo")) {
    const picture = acceptPhoto(body.photo, body.photoId);
    fields.photo = picture.photo;
    fields.photoId = picture.photoId;
    if (req.member.photoId && req.member.photoId !== picture.photoId) replacedId = req.member.photoId;
  }

  const nextPassword = String(body.pw ?? "");
  let nextHash = "";
  if (nextPassword) {
    const current = String(body.currentPw ?? "");
    const ok = await bcrypt.compare(current, req.member.passwordHash);
    if (!ok) throw new HttpError(400, "Current password is incorrect.");
    nextHash = await bcrypt.hash(assertPassword(nextPassword), 10);
  }

  await updateMemberProfile(req.member.id, fields);
  if (nextHash) await savePassword("member", req.member.id, nextHash);
  if (replacedId) await removePhoto(replacedId);
  res.json({ member: publicMember(await getMemberById(req.member.id)) });
}));

async function identityFields(body, exceptId) {
  const name = text(body.name, 80);
  const email = text(body.email, 160).toLowerCase();
  const mobile = normMobile(body.mobile);
  if (!name) throw new HttpError(400, "Enter your full name.");
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email ID.");
  if (!isMobile(mobile)) throw new HttpError(400, "Enter a valid 10-digit mobile number.");
  if (await emailTaken(email, exceptId)) throw new HttpError(400, "This email is already registered.");
  if (await mobileTaken(mobile, exceptId)) throw new HttpError(400, "This mobile number is already registered.");
  return { name, email, mobile };
}

app.post("/api/me/identity-request", memberOnly, wrap(async (req, res) => {
  const next = await identityFields(req.body || {}, req.member.id);
  if (next.name === req.member.name && next.email === req.member.email && next.mobile === req.member.mobile) {
    throw new HttpError(400, "Those details already match your account.");
  }
  await updateMemberProfile(req.member.id, {
    identityRequest: { ...next, requestedAt: Date.now() },
  });
  res.json({ member: publicMember(await getMemberById(req.member.id)) });
}));

app.delete("/api/me/identity-request", memberOnly, wrap(async (req, res) => {
  await updateMemberProfile(req.member.id, { identityRequest: null });
  res.json({ member: publicMember(await getMemberById(req.member.id)) });
}));

app.delete("/api/me", memberOnly, wrap(async (req, res) => {
  const changes = await deleteMember(req.member.id, req.member.instId);
  if (!changes) throw new HttpError(404, "That account was not found.");
  await removePhoto(req.member.photoId);
  res.clearCookie("ac_token", clearCookieOpts);
  res.json({ ok: true });
}));

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid request." });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Image must be 2 MB or smaller." });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong. Try again." : err.message });
});

const port = Number(process.env.PORT || 4000);
await connectDb();
app.listen(port, () => {
  console.log(`PupilsWeb API on http://localhost:${port}`);
});
