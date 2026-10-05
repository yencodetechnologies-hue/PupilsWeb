export const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
export const MARITAL = ["Single", "Married", "Widowed", "Divorced"];

export const EMPTY_ADDRESS = { door: "", street: "", road: "", area: "", district: "", state: "", country: "", pincode: "" };
export const EMPTY_JOB = { orgName: "", designation: "", orgType: "", contact: "" };
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
    curAddress: { ...EMPTY_ADDRESS, ...(member.curAddress || {}) },
    nativeAddress: { ...EMPTY_ADDRESS, ...(member.nativeAddress || {}) },
    currentJob: { ...EMPTY_JOB, ...(member.currentJob || {}) },
    previousJob: { ...EMPTY_JOB, ...(member.previousJob || {}) },
    collegeUg: { ...EMPTY_STUDY, ...(member.collegeUg || {}) },
    collegePg: { ...EMPTY_STUDY, ...(member.collegePg || {}) },
    siblings: padList(member.siblings, EMPTY_SIBLING, 2),
    otherSchools: member.otherSchools?.length ? member.otherSchools.map((item) => ({ ...EMPTY_SCHOOL, ...item })) : [{ ...EMPTY_SCHOOL }],
    kids: padList(member.kids, EMPTY_KID, 4),
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
