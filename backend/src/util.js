import "./env.js";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const SECRET = process.env.JWT_SECRET || "alumni-connect-dev-secret";
export const TYPES = ["School", "College", "Other"];
export const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
export const GENDERS = ["Male", "Female", "Prefer not to say"];
export const MARITAL = ["Single", "Married", "Widowed", "Divorced"];
export const SIBLING_GENDERS = ["Male", "Female"];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
export const normMobile = (value) => String(value || "").replace(/\D/g, "").slice(-10);
export const isMobile = (value) => /^[6-9]\d{9}$/.test(normMobile(value));

export function text(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

export function makeId() {
  return crypto.randomUUID();
}

export function makeCode(len = 10) {
  const bytes = crypto.randomBytes(len);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function validYear(value) {
  const year = Number(value);
  const max = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1950 && year <= max;
}

export function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function newOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function signToken(payload, expiresIn = "7d") {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function readToken(token) {
  return jwt.verify(token, SECRET);
}

export const cookieOpts = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const clearCookieOpts = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  path: "/",
};

export function ageFromDob(dob) {
  if (!dob) return "";
  const date = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age -= 1;
  if (age < 0 || age > 120) return "";
  return String(age);
}

export function cleanAge(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 3);
  if (!digits) return "";
  const age = Number(digits);
  if (age > 120) return "";
  return String(age);
}

export function cleanKidsCount(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  return String(Math.min(20, Number(digits)));
}

export function cleanAddress(value) {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  for (const key of ["door", "street", "road", "area", "district", "state", "country", "pincode"]) {
    next[key] = text(source[key], key === "pincode" ? 12 : 120);
  }
  return next;
}

export function addressLine(addr) {
  return ["door", "street", "road", "area", "district", "state", "country", "pincode"]
    .map((key) => addr?.[key])
    .filter(Boolean)
    .join(", ");
}

export function cleanJob(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    orgName: text(source.orgName, 160),
    designation: text(source.designation, 120),
    orgType: text(source.orgType, 120),
    contact: text(source.contact, 400),
  };
}

export function cleanStudy(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    name: text(source.name, 160),
    year: text(source.year, 20),
    department: text(source.department, 120),
  };
}

export function cleanSiblings(items) {
  return cleanList(items, ["name", "gender", "dob", "org", "alumniId"], 2).map((item) => ({
    ...item,
    gender: SIBLING_GENDERS.includes(item.gender) ? item.gender : "",
  }));
}

export function cleanList(items, keys, limit = 12) {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, limit)
    .map((item) => {
      const next = {};
      for (const key of keys) next[key] = text(item?.[key], key === "desc" ? 400 : 160);
      return next;
    })
    .filter((item) => Object.values(item).some(Boolean));
}

export function fmtDate(ts) {
  return new Date(Number(ts)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
