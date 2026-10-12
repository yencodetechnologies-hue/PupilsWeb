export const VISIBILITY_LEVELS = ["everyone", "batch", "off"];

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

const EMPTY_ADDRESS = { door: "", street: "", road: "", area: "", district: "", state: "", country: "", pincode: "" };
const EMPTY_JOB = { orgName: "", designation: "", orgType: "", address: "", phone: "", email: "", contact: "" };
const EMPTY_STUDY = { name: "", year: "", department: "" };

export function visibilityOf(row) {
  const stored = row?.visibility && typeof row.visibility === "object" ? row.visibility : {};
  const next = { ...VISIBILITY_DEFAULTS };
  for (const key of Object.keys(VISIBILITY_DEFAULTS)) {
    if (VISIBILITY_LEVELS.includes(stored[key])) next[key] = stored[key];
  }
  return next;
}

export function cleanVisibility(value, current) {
  const next = visibilityOf({ visibility: current });
  const source = value && typeof value === "object" ? value : {};
  for (const key of Object.keys(VISIBILITY_DEFAULTS)) {
    if (VISIBILITY_LEVELS.includes(source[key])) next[key] = source[key];
  }
  return next;
}

function allowed(level, sameBatch) {
  if (level === "everyone") return true;
  if (level === "batch") return sameBatch;
  return false;
}

export function applyVisibility(member, viewer) {
  if (!member) return null;
  if (!viewer || viewer.id === member.id) return member;
  const sameBatch = Number(viewer.batch) === Number(member.batch);
  const vis = member.visibility || VISIBILITY_DEFAULTS;
  const see = (key) => allowed(vis[key], sameBatch);
  const hide = (key, empty) => {
    if (!see(key)) member[key] = empty;
  };

  hide("memberNo", "");
  hide("yearCompleted", "");
  hide("classLeaving", "");
  hide("age", "");
  hide("email", "");
  hide("mobile", "");
  hide("dob", "");
  hide("gender", "");
  hide("blood", "");
  hide("father", "");
  hide("fatherOccupation", "");
  hide("fatherCompany", "");
  hide("mother", "");
  hide("motherOccupation", "");
  hide("motherCompany", "");
  hide("maritalStatus", "");
  hide("spouseName", "");
  hide("spouseOccupation", "");
  hide("spouseCompany", "");
  hide("kidsCount", "");
  hide("siblings", []);
  hide("kids", []);
  hide("otherSchools", []);
  hide("currentJob", { ...EMPTY_JOB });
  hide("previousJob", { ...EMPTY_JOB });
  hide("collegeUg", { ...EMPTY_STUDY });
  hide("collegePg", { ...EMPTY_STUDY });

  if (!see("curAddress")) {
    member.curAddress = { ...EMPTY_ADDRESS };
    member.curAddr = "";
    member.city = "";
  }
  if (!see("nativeAddress")) {
    member.nativeAddress = { ...EMPTY_ADDRESS };
    member.nativeAddr = "";
  }
  if (!see("currentJob")) {
    member.occupation = "";
    member.businesses = [];
  }
  if (!see("otherSchools")) member.schools = [];
  if (!see("collegeUg") && !see("collegePg")) {
    member.colleges = [];
    member.qualification = "";
  }
  member.links = [];
  member.identityRequest = null;
  delete member.visibility;
  return member;
}
