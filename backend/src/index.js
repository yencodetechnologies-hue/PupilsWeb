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
  membersFor,
  mobileTaken,
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
  TYPES,
  cleanList,
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

app.delete("/api/members/:id", admin, wrap(async (req, res) => {
  const row = await getMemberById(req.params.id);
  if (!row || row.instId !== req.inst.id) return res.status(404).json({ error: "That alumni record was not found." });
  const changes = await deleteMember(req.params.id, req.inst.id);
  if (!changes) return res.status(404).json({ error: "That alumni record was not found." });
  await removePhoto(row.photoId);
  res.json({ ok: true });
}));

app.get("/api/members/export.csv", admin, wrap(async (req, res) => {
  const inst = publicInst(req.inst);
  const members = (await membersFor(req.inst.id)).sort((a, b) => a.batch - b.batch || a.name.localeCompare(b.name));
  const cols = ["batch", "name", "email", "mobile", "photo", "dob", "gender", "blood", "father", "mother", "curAddr", "city", "nativeAddr", "qualification", "occupation"];
  const q = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    [...cols, "schools", "colleges", "businesses", "links", "joined"].join(","),
    ...members.map((member) => [
      ...cols.map((col) => q(member[col])),
      q((member.schools || []).map((item) => item.name).join("; ")),
      q((member.colleges || []).map((item) => item.name).join("; ")),
      q((member.businesses || []).map((item) => item.name).join("; ")),
      q((member.links || []).map((item) => item.url).join("; ")),
      q(fmtDate(member.joinedAt)),
    ].join(",")),
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
  const father = text(body.father, 80);
  const mother = text(body.mother, 80);
  const city = text(body.city, 80);
  const qualification = text(body.qualification, 120);
  const gender = GENDERS.includes(body.gender) ? body.gender : "";
  const blood = BLOOD.includes(body.blood) ? body.blood : "";
  const picture = body.photo || body.photoId ? acceptPhoto(body.photo, body.photoId) : { photo: "", photoId: "" };

  if (!pub.batches.includes(batch)) throw new HttpError(400, "Select your batch.");
  if (!name) throw new HttpError(400, "Enter your full name.");
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email ID.");
  if (!isMobile(mobile)) throw new HttpError(400, "Enter a valid 10-digit mobile number.");
  if (!father || !mother) throw new HttpError(400, "Enter your father's and mother's names.");
  if (!city) throw new HttpError(400, "Enter your current city.");
  if (!qualification) throw new HttpError(400, "Enter your highest qualification.");
  if (await emailTaken(email)) throw new HttpError(400, "This email is already registered. Sign in instead.");
  if (await mobileTaken(mobile)) throw new HttpError(400, "This mobile number is already registered.");

  const row = {
    id: makeId(),
    instId: inst.id,
    batch,
    name,
    email,
    mobile,
    passwordHash: await bcrypt.hash(password, 10),
    dob: text(body.dob, 20),
    gender,
    blood,
    father,
    mother,
    curAddr: text(body.curAddr, 400),
    city,
    nativeAddr: text(body.nativeAddr, 400),
    qualification,
    occupation: text(body.occupation, 120),
    schools: cleanList(body.schools, ["name", "board", "from", "to"]),
    colleges: cleanList(body.colleges, ["name", "degree", "from", "to"]),
    businesses: cleanList(body.businesses, ["name", "industry", "role", "city", "phone", "web", "desc"]),
    links: cleanList(body.links, ["label", "url"]),
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

  if (has("name")) {
    const name = text(body.name, 80);
    if (!name) throw new HttpError(400, "Enter your full name.");
    fields.name = name;
  }
  if (has("email")) {
    const email = text(body.email, 160).toLowerCase();
    if (!isEmail(email)) throw new HttpError(400, "Enter a valid email ID.");
    if (await emailTaken(email, req.member.id)) throw new HttpError(400, "This email is already registered.");
    fields.email = email;
  }
  if (has("mobile")) {
    const mobile = normMobile(body.mobile);
    if (!isMobile(mobile)) throw new HttpError(400, "Enter a valid 10-digit mobile number.");
    if (await mobileTaken(mobile, req.member.id)) throw new HttpError(400, "This mobile number is already registered.");
    fields.mobile = mobile;
  }
  if (has("batch")) {
    const inst = await getInstById(req.member.instId);
    const batch = Number(body.batch);
    const years = publicInst(inst)?.batches || [];
    if (!years.includes(batch)) throw new HttpError(400, "Select your batch.");
    fields.batch = batch;
  }
  if (has("father")) fields.father = text(body.father, 80);
  if (has("mother")) fields.mother = text(body.mother, 80);
  if (has("city")) fields.city = text(body.city, 80);
  if (has("qualification")) fields.qualification = text(body.qualification, 120);
  if (has("occupation")) fields.occupation = text(body.occupation, 120);
  if (has("dob")) fields.dob = text(body.dob, 20);
  if (has("gender")) fields.gender = GENDERS.includes(body.gender) ? body.gender : "";
  if (has("blood")) fields.blood = BLOOD.includes(body.blood) ? body.blood : "";
  if (has("curAddr")) fields.curAddr = text(body.curAddr, 400);
  if (has("nativeAddr")) fields.nativeAddr = text(body.nativeAddr, 400);
  if (has("schools")) fields.schools = cleanList(body.schools, ["name", "board", "from", "to"]);
  if (has("colleges")) fields.colleges = cleanList(body.colleges, ["name", "degree", "from", "to"]);
  if (has("businesses")) fields.businesses = cleanList(body.businesses, ["name", "industry", "role", "city", "phone", "web", "desc"]);
  if (has("links")) fields.links = cleanList(body.links, ["label", "url"]);

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
