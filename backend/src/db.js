import "./env.js";
import { MongoClient } from "mongodb";

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

export function publicMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    instId: row.instId,
    batch: Number(row.batch),
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    dob: row.dob || "",
    gender: row.gender || "",
    blood: row.blood || "",
    father: row.father || "",
    mother: row.mother || "",
    curAddr: row.curAddr || "",
    city: row.city || "",
    nativeAddr: row.nativeAddr || "",
    qualification: row.qualification || "",
    occupation: row.occupation || "",
    schools: Array.isArray(row.schools) ? row.schools : [],
    colleges: Array.isArray(row.colleges) ? row.colleges : [],
    businesses: Array.isArray(row.businesses) ? row.businesses : [],
    links: Array.isArray(row.links) ? row.links : [],
    photo: row.photo || "",
    joinedAt: Number(row.joinedAt),
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
    batch: row.batch,
    name: row.name,
    email: String(row.email).toLowerCase(),
    mobile: row.mobile,
    passwordHash: row.passwordHash,
    dob: row.dob || "",
    gender: row.gender || "",
    blood: row.blood || "",
    father: row.father || "",
    mother: row.mother || "",
    curAddr: row.curAddr || "",
    city: row.city || "",
    nativeAddr: row.nativeAddr || "",
    qualification: row.qualification || "",
    occupation: row.occupation || "",
    schools: row.schools || [],
    colleges: row.colleges || [],
    businesses: row.businesses || [],
    links: row.links || [],
    photo: row.photo || "",
    photoId: row.photoId || "",
    joinedAt: row.joinedAt,
  });
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
  return members().countDocuments({ instId, batch: year });
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

export async function batchmates(instId, batch, exceptId) {
  return members()
    .find(
      { instId, batch, id: { $ne: exceptId } },
      { projection: { _id: 0, id: 1, name: 1, city: 1, occupation: 1, qualification: 1, photo: 1 } }
    )
    .sort({ name: 1 })
    .toArray();
}
