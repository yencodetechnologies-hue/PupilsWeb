export const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
export const MARITAL = ["Single", "Married", "Widowed", "Divorced"];
export const COUNTRIES = ["India", "Sri Lanka", "Singapore", "Malaysia", "United Arab Emirates", "United States", "United Kingdom", "Canada", "Australia", "Other"];
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export const VISIBILITY_DEFAULTS = {
  memberNo: "batch",
  age: "batch",
  gender: "batch",
  dob: "off",
  mobile: "batch",
  blood: "off",
  email: "batch",
  yearCompleted: "batch",
  classLeaving: "batch",
  curAddress: "batch",
  nativeAddress: "batch",
  father: "off",
  fatherOccupation: "off",
  fatherCompany: "off",
  mother: "off",
  motherOccupation: "off",
  motherCompany: "off",
  siblings: "off",
  otherSchools: "batch",
  currentJob: "batch",
  previousJob: "batch",
  collegeUg: "batch",
  collegePg: "batch",
  maritalStatus: "off",
  spouseName: "off",
  spouseOccupation: "off",
  spouseCompany: "off",
  kidsCount: "off",
  kids: "off",
};

export const EMPTY_ADDRESS = { door: "", street: "", road: "", area: "", district: "", state: "", country: "India", pincode: "" };
export const EMPTY_JOB = { orgName: "", designation: "", orgType: "", address: "", phone: "", email: "", contact: "" };
export const EMPTY_STUDY = { name: "", year: "", department: "" };
export const EMPTY_SIBLING = { name: "", gender: "", dob: "", org: "", alumniId: "" };
export const EMPTY_SCHOOL = { name: "", yearCompleted: "", classLeaving: "" };
export const EMPTY_KID = { name: "", dob: "", school: "", classYear: "" };

const ADDRESS_KEYS = ["door", "street", "road", "area", "district", "state", "country", "pincode"];

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

export function padList(items, blank, count) {
  const list = (Array.isArray(items) ? items : []).map((item) => ({ ...blank, ...item }));
  while (list.length < count) list.push({ ...blank });
  return list.slice(0, count);
}

function filledCount(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item && Object.values(item).some(Boolean)).length;
}

export function jobForm(job) {
  const next = { ...EMPTY_JOB, ...(job || {}) };
  if (!next.address && !next.phone && !next.email && next.contact) next.address = next.contact;
  return next;
}

export function spouseRelevant(status) {
  return status === "Married" || status === "Widowed" || status === "Divorced";
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value || "").replace(/\D/g, "").slice(-10));

function badDate(value) {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return true;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
}

function badPin(addr) {
  const code = String(addr?.pincode || "").trim();
  if (!code) return false;
  const india = !addr.country || addr.country === "India";
  return india ? !/^\d{6}$/.test(code) : !/^[A-Za-z0-9 -]{3,12}$/.test(code);
}

export function formIssues(form) {
  const issues = {};
  if (form.email && !isEmail(form.email)) issues.email = "badEmail";
  if (form.mobile && !isMobile(form.mobile)) issues.mobile = "badMobile";
  if (badDate(form.dob)) issues.dob = "badDate";
  if (badPin(form.curAddress)) issues["curAddress.pincode"] = "badPincode";
  if (badPin(form.nativeAddress)) issues["nativeAddress.pincode"] = "badPincode";
  for (const key of ["currentJob", "previousJob"]) {
    const job = form[key] || {};
    if (job.email && !isEmail(job.email)) issues[`${key}.email`] = "badJobEmail";
    if (job.phone && !isMobile(job.phone)) issues[`${key}.phone`] = "badJobPhone";
  }
  (form.siblings || []).forEach((item, index) => {
    if (badDate(item.dob)) issues[`siblings.${index}.dob`] = "badDate";
  });
  (form.kids || []).forEach((item, index) => {
    if (badDate(item.dob)) issues[`kids.${index}.dob`] = "badDate";
  });
  return issues;
}

export function visibilityFrom(member) {
  const stored = member?.visibility && typeof member.visibility === "object" ? member.visibility : {};
  const next = { ...VISIBILITY_DEFAULTS };
  for (const key of Object.keys(VISIBILITY_DEFAULTS)) {
    if (stored[key] === "everyone" || stored[key] === "batch" || stored[key] === "off") next[key] = stored[key];
  }
  return next;
}

export function addressLine(addr) {
  if (!addr) return "";
  return ADDRESS_KEYS.map((key) => addr[key]).filter(Boolean).join(", ");
}

export function emptyMemberForm() {
  return {
    memberNo: "",
    batch: "",
    yearCompleted: "",
    classLeaving: "",
    name: "",
    age: "",
    gender: "",
    dob: "",
    mobile: "",
    blood: "",
    email: "",
    father: "",
    fatherOccupation: "",
    fatherCompany: "",
    mother: "",
    motherOccupation: "",
    motherCompany: "",
    maritalStatus: "",
    spouseName: "",
    spouseOccupation: "",
    spouseCompany: "",
    kidsCount: "",
    curAddress: { ...EMPTY_ADDRESS },
    nativeAddress: { ...EMPTY_ADDRESS },
    currentJob: { ...EMPTY_JOB },
    previousJob: { ...EMPTY_JOB },
    collegeUg: { ...EMPTY_STUDY },
    collegePg: { ...EMPTY_STUDY },
    siblings: padList([], EMPTY_SIBLING, 2),
    otherSchools: [{ ...EMPTY_SCHOOL }],
    kids: padList([], EMPTY_KID, 4),
  };
}

export function formFromMember(member) {
  const base = emptyMemberForm();
  return {
    ...base,
    memberNo: member.memberNo || "",
    batch: member.batch ? String(member.batch) : "",
    yearCompleted: member.yearCompleted || "",
    classLeaving: member.classLeaving || "",
    name: member.name || "",
    age: member.age || ageFromDob(member.dob) || "",
    gender: member.gender || "",
    dob: member.dob || "",
    mobile: member.mobile || "",
    blood: member.blood || "",
    email: member.email || "",
    father: member.father || "",
    fatherOccupation: member.fatherOccupation || "",
    fatherCompany: member.fatherCompany || "",
    mother: member.mother || "",
    motherOccupation: member.motherOccupation || "",
    motherCompany: member.motherCompany || "",
    maritalStatus: member.maritalStatus || "",
    spouseName: member.spouseName || "",
    spouseOccupation: member.spouseOccupation || "",
    spouseCompany: member.spouseCompany || "",
    kidsCount: member.kidsCount || "",
    curAddress: { ...EMPTY_ADDRESS, ...(member.curAddress || {}), country: member.curAddress?.country || "India" },
    nativeAddress: { ...EMPTY_ADDRESS, ...(member.nativeAddress || {}), country: member.nativeAddress?.country || "India" },
    currentJob: jobForm(member.currentJob),
    previousJob: jobForm(member.previousJob),
    collegeUg: { ...EMPTY_STUDY, ...(member.collegeUg || {}) },
    collegePg: { ...EMPTY_STUDY, ...(member.collegePg || {}) },
    siblings: padList(member.siblings, EMPTY_SIBLING, Math.max(2, filledCount(member.siblings))),
    otherSchools: member.otherSchools?.length ? member.otherSchools.map((item) => ({ ...EMPTY_SCHOOL, ...item })) : [{ ...EMPTY_SCHOOL }],
    kids: padList(
      member.kids,
      EMPTY_KID,
      member.kidsCount === "" || member.kidsCount == null
        ? Math.max(4, filledCount(member.kids))
        : Math.max(Number(member.kidsCount) || 0, filledCount(member.kids)),
    ),
  };
}

export function applyField(form, key, value) {
  const next = { ...form, [key]: value };
  if (key === "dob") {
    const age = ageFromDob(value);
    if (age) next.age = age;
  }
  return next;
}

export function spouseLabelKeys(gender) {
  if (gender === "Female") {
    return { name: "husbandName", occupation: "husbandOccupation", company: "husbandCompany" };
  }
  return { name: "wifeName", occupation: "wifeOccupation", company: "wifeCompany" };
}
