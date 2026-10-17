import "./env.js";
import { MongoClient } from "mongodb";
import { visibilityOf } from "./visibility.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is missing. Set it in backend/.env");
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
let database;

export async function connectDb() {
  await client.connect();
  database = client.db();
  const institutions = database.collection("institutions");
  const members = database.collection("members");
  const otps = database.collection("otps");
  await institutions.createIndex({ code: 1 }, { unique: true });
  await institutions.createIndex({ adminEmail: 1 }, { unique: true });
  await institutions.createIndex({ adminMobile: 1 });
  await members.createIndex({ email: 1 }, { unique: true });
  await members.createIndex({ mobile: 1 });
  await members.createIndex({ instId: 1, batch: 1 });
  await otps.createIndex({ email: 1 }, { unique: true });
}

const institutions = () => database.collection("institutions");
const members = () => database.collection("members");
const otps = () => database.collection("otps");

function clean(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

export function publicInst(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    name: row.name,
    batches: Array.isArray(row.batches) ? row.batches : [],
    createdAt: Number(row.createdAt),
    admin: {
      name: row.adminName,
      email: row.adminEmail,
      mobile: row.adminMobile,
    },
  };
}

function addressOf(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    door: source.door || "",
    street: source.street || "",
    road: source.road || "",
    area: source.area || "",
    district: source.district || "",
    state: source.state || "",
    country: source.country || "",
    pincode: source.pincode || "",
  };
}

function jobOf(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    orgName: source.orgName || "",
    designation: source.designation || "",
    orgType: source.orgType || "",
    address: source.address || "",
    phone: source.phone || "",
    email: source.email || "",
    contact: source.contact || "",
  };
}

function studyOf(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    name: source.name || "",
    year: source.year || "",
    department: source.department || "",
  };
}

export function publicMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    instId: row.instId,
    memberNo: row.memberNo || "",
    batch: Number(row.batch),
    yearCompleted: row.yearCompleted || "",
    classLeaving: row.classLeaving || "",
    name: row.name,
    age: row.age || "",
    email: row.email,
    mobile: row.mobile,
    dob: row.dob || "",
    gender: row.gender || "",
    blood: row.blood || "",
    father: row.father || "",
    fatherOccupation: row.fatherOccupation || "",
    fatherCompany: row.fatherCompany || "",
    mother: row.mother || "",
    motherOccupation: row.motherOccupation || "",
    motherCompany: row.motherCompany || "",
    curAddress: addressOf(row.curAddress),
    nativeAddress: addressOf(row.nativeAddress),
    curAddr: row.curAddr || "",
    city: row.city || "",
    nativeAddr: row.nativeAddr || "",
    qualification: row.qualification || "",
    occupation: row.occupation || "",
    siblings: Array.isArray(row.siblings) ? row.siblings : [],
    otherSchools: Array.isArray(row.otherSchools) ? row.otherSchools : [],
    schools: Array.isArray(row.schools) ? row.schools : [],
    colleges: Array.isArray(row.colleges) ? row.colleges : [],
    currentJob: jobOf(row.currentJob),
    previousJob: jobOf(row.previousJob),
    collegeUg: studyOf(row.collegeUg),
    collegePg: studyOf(row.collegePg),
    businesses: Array.isArray(row.businesses) ? row.businesses : [],
    links: Array.isArray(row.links) ? row.links : [],
    maritalStatus: row.maritalStatus || "",
    spouseName: row.spouseName || "",
    spouseOccupation: row.spouseOccupation || "",
    spouseCompany: row.spouseCompany || "",
    kidsCount: row.kidsCount || "",
    kids: Array.isArray(row.kids) ? row.kids : [],
    photo: row.photo || "",
    joinedAt: Number(row.joinedAt),
    identityRequest: identityRequestOf(row.identityRequest),
    visibility: visibilityOf(row),
  };
}

function identityRequestOf(value) {
  if (!value || typeof value !== "object" || !value.name) return null;
  return {
    name: value.name,
    email: value.email || "",
    mobile: value.mobile || "",
    requestedAt: Number(value.requestedAt) || 0,
  };
}

export const getInstById = async (id) => clean(await institutions().findOne({ id }));

export const getInstByCode = async (code) =>
  clean(await institutions().findOne({ code: String(code || "").toUpperCase() }));

export const getMemberById = async (id) => clean(await members().findOne({ id }));

export async function findByEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  const inst = clean(await institutions().findOne({ adminEmail: value }));
  if (inst) return { kind: "admin", row: inst };
  const member = clean(await members().findOne({ email: value }));
  if (member) return { kind: "member", row: member };
  return null;
}

export async function findByMobile(mobile) {
  const inst = clean(await institutions().findOne({ adminMobile: mobile }));
  if (inst) return { kind: "admin", row: inst };
  const member = clean(await members().findOne({ mobile }));
  if (member) return { kind: "member", row: member };
  return null;
}

export async function emailTaken(email, exceptId, exceptKind = "member") {
  const found = await findByEmail(email);
  if (!found) return false;
  if (exceptId && found.kind === exceptKind && found.row.id === exceptId) return false;
  return true;
}

export async function mobileTaken(mobile, exceptId, exceptKind = "member") {
  const found = await findByMobile(mobile);
  if (!found) return false;
  if (exceptId && found.kind === exceptKind && found.row.id === exceptId) return false;
  return true;
}

export async function insertInstitution(row) {
  await institutions().insertOne({
    id: row.id,
    code: row.code,
    type: row.type,
    name: row.name,
    adminName: row.adminName,
    adminEmail: String(row.adminEmail).toLowerCase(),
    adminMobile: row.adminMobile,
    passwordHash: row.passwordHash,
    batches: row.batches || [],
    createdAt: row.createdAt,
  });
}

export async function insertMember(row) {
  await members().insertOne({
    id: row.id,
    instId: row.instId,
    memberNo: row.memberNo || "",
    batch: row.batch,
    yearCompleted: row.yearCompleted || "",
    classLeaving: row.classLeaving || "",
    name: row.name,
    age: row.age || "",
    email: String(row.email).toLowerCase(),
    mobile: row.mobile,
    passwordHash: row.passwordHash,
    dob: row.dob || "",
    gender: row.gender || "",
    blood: row.blood || "",
    father: row.father || "",
    fatherOccupation: row.fatherOccupation || "",
    fatherCompany: row.fatherCompany || "",
    mother: row.mother || "",
    motherOccupation: row.motherOccupation || "",
    motherCompany: row.motherCompany || "",
    curAddress: addressOf(row.curAddress),
    nativeAddress: addressOf(row.nativeAddress),
    curAddr: row.curAddr || "",
    city: row.city || "",
    nativeAddr: row.nativeAddr || "",
    qualification: row.qualification || "",
    occupation: row.occupation || "",
    siblings: row.siblings || [],
    otherSchools: row.otherSchools || [],
    schools: row.schools || [],
    colleges: row.colleges || [],
    currentJob: jobOf(row.currentJob),
    previousJob: jobOf(row.previousJob),
    collegeUg: studyOf(row.collegeUg),
    collegePg: studyOf(row.collegePg),
    businesses: row.businesses || [],
    links: row.links || [],
    maritalStatus: row.maritalStatus || "",
    spouseName: row.spouseName || "",
    spouseOccupation: row.spouseOccupation || "",
    spouseCompany: row.spouseCompany || "",
    kidsCount: row.kidsCount || "",
    kids: row.kids || [],
    photo: row.photo || "",
    photoId: row.photoId || "",
    joinedAt: row.joinedAt,
  });
}

export async function memberNoTaken(instId, memberNo, exceptId) {
  if (!memberNo) return false;
  const found = await members().findOne({
    instId,
    memberNo,
    ...(exceptId ? { id: { $ne: exceptId } } : {}),
  });
  return Boolean(found);
}

export async function nextMemberNo(instId) {
  const rows = await members().find({ instId }, { projection: { _id: 0, memberNo: 1 } }).toArray();
  let max = 0;
  for (const row of rows) {
    const value = String(row.memberNo || "").trim();
    if (/^\d+$/.test(value)) max = Math.max(max, Number(value));
  }
  return String(max + 1);
}

export async function membersFor(instId) {
  const rows = await members().find({ instId }).sort({ joinedAt: -1 }).toArray();
  return rows.map((row) => publicMember(clean(row)));
}

export async function saveBatches(id, batches) {
  await institutions().updateOne({ id }, { $set: { batches } });
}

export async function saveCode(id, code) {
  await institutions().updateOne({ id }, { $set: { code } });
}

export async function saveInstitutionProfile(id, name, type) {
  await institutions().updateOne({ id }, { $set: { name, type } });
}

export async function saveAdminAccount(id, fields) {
  await institutions().updateOne({ id }, { $set: fields });
}

export async function savePassword(kind, id, passwordHash) {
  const collection = kind === "admin" ? institutions() : members();
  await collection.updateOne({ id }, { $set: { passwordHash } });
}

export async function updateMemberProfile(id, fields) {
  if (!fields || !Object.keys(fields).length) return;
  await members().updateOne({ id }, { $set: fields });
}

export async function saveMemberPhoto(id, photo, photoId) {
  await members().updateOne({ id }, { $set: { photo: photo || "", photoId: photoId || "" } });
}

export async function countInBatch(instId, year) {
  const numeric = Number(year);
  const text = String(year);
  return members().countDocuments({
    instId,
    $or: [
      { yearCompleted: text },
      { yearCompleted: numeric },
      {
        batch: numeric,
        $or: [
          { yearCompleted: "" },
          { yearCompleted: null },
          { yearCompleted: { $exists: false } },
        ],
      },
    ],
  });
}

export async function deleteMember(id, instId) {
  const result = await members().deleteOne({ id, instId });
  return result.deletedCount;
}

export async function saveOtp({ email, codeHash, expiresAt, kind, accountId }) {
  await otps().updateOne(
    { email },
    { $set: { email, codeHash, expiresAt, verified: false, kind, accountId } },
    { upsert: true }
  );
}

export async function getOtp(email) {
  return clean(await otps().findOne({ email }));
}

export async function markOtpVerified(email) {
  await otps().updateOne({ email }, { $set: { verified: true } });
}

export async function deleteOtp(email) {
  await otps().deleteOne({ email });
}

export async function batchmates(instId, member, exceptId) {
  const completed = String(member?.yearCompleted || "").trim();
  const numeric = Number(completed);
  const filter = { instId, id: { $ne: exceptId } };
  if (completed) {
    filter.$or = Number.isFinite(numeric)
      ? [{ yearCompleted: completed }, { yearCompleted: numeric }]
      : [{ yearCompleted: completed }];
  } else if (member?.batch != null && member.batch !== "") {
    filter.batch = Number(member.batch);
    filter.$or = [
      { yearCompleted: "" },
      { yearCompleted: null },
      { yearCompleted: { $exists: false } },
    ];
  } else {
    return [];
  }
  const rows = await members().find(filter).sort({ name: 1 }).toArray();
  return rows.map(clean);
}

export async function alumniSearch(instId, exceptId, query) {
  const q = String(query || "").trim();
  const filter = { instId, id: { $ne: exceptId } };
  if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const rows = await members().find(filter).sort({ name: 1 }).limit(50).toArray();
  return rows.map(clean);
}

const events = () => database.collection("events");

export async function eventsFor(instId) {
  const rows = await events().find({ instId }).sort({ startAt: -1 }).toArray();
  return rows.map(clean);
}

export async function getEvent(id) {
  return clean(await events().findOne({ id }));
}

export async function insertEvent(row) {
  await events().insertOne(row);
}

export async function updateEvent(id, fields) {
  await events().updateOne({ id }, { $set: fields });
}

export async function deleteEvent(id, instId) {
  return (await events().deleteOne({ id, instId })).deletedCount;
}

export const col = (name) => database.collection(name);
