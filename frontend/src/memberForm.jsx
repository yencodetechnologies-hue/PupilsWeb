import { Field } from "./components";
import { useI18n } from "./i18n";
import {
  BLOOD,
  EMPTY_SCHOOL,
  MARITAL,
  applyField,
  spouseLabelKeys,
} from "./memberShape";

const ADDRESS_FIELDS = [
  ["door", "doorNo"],
  ["street", "street"],
  ["road", "road"],
  ["area", "area"],
  ["district", "district"],
  ["state", "stateName"],
  ["country", "country"],
  ["pincode", "pincode"],
];

function binders(setForm) {
  const set = (key) => (event) => setForm((current) => applyField(current, key, event.target.value));
  const setNest = (group, key) => (event) => setForm((current) => ({
    ...current,
    [group]: { ...current[group], [key]: event.target.value },
  }));
  const setRow = (list, index, key) => (event) => setForm((current) => ({
    ...current,
    [list]: current[list].map((item, i) => (i === index ? { ...item, [key]: event.target.value } : item)),
  }));
  return { set, setNest, setRow };
}

export function MembershipFields({ form, setForm, batches, password, lockIdentity }) {
  const { t } = useI18n();
  const { set } = binders(setForm);
  const years = [...(batches || [])];
  const known = years.map(Number);
  return (
    <section>
      <h2>{t("membershipTitle")}</h2>
      <p className="sub">{t("membershipHint")}</p>
      <Field label={t("memberNo")} hint={t("memberNoHint")}>
        <input value={form.memberNo} onChange={set("memberNo")} />
      </Field>
      <div className="row3">
        <Field label={t("yearJoined")}>
          <select value={form.batch} onChange={set("batch")}>
            <option value="">{t("selectYourBatch")}</option>
            {form.batch && !known.includes(Number(form.batch)) && <option value={form.batch}>{t("batchTag", { year: form.batch })}</option>}
            {[...years].sort((a, b) => b - a).map((year) => <option key={year} value={year}>{t("batchTag", { year })}</option>)}
          </select>
        </Field>
        <Field label={t("yearCompleted")}>
          <input inputMode="numeric" value={form.yearCompleted} onChange={set("yearCompleted")} />
        </Field>
        <Field label={t("classLeaving")}>
          <input value={form.classLeaving} onChange={set("classLeaving")} />
        </Field>
      </div>
      {lockIdentity && <p className="sub">{t("identityLocked")}</p>}
      <Field label={t("fullName")}>
        <input autoComplete="name" value={form.name} onChange={set("name")} readOnly={lockIdentity} disabled={lockIdentity} />
      </Field>
      <div className="row3">
        <Field label={t("age")}>
          <input inputMode="numeric" value={form.age} onChange={set("age")} />
        </Field>
        <Field label={t("gender")}>
          <select value={form.gender} onChange={set("gender")}>
            <option value="">{t("select")}</option>
            <option value="Male">{t("genderMale")}</option>
            <option value="Female">{t("genderFemale")}</option>
            <option value="Prefer not to say">{t("genderSkip")}</option>
          </select>
        </Field>
        <Field label={t("dateOfBirth")}>
          <input type="date" value={form.dob} onChange={set("dob")} />
        </Field>
      </div>
      <div className="row">
        <Field label={t("mobileNumber")}>
          <input inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} readOnly={lockIdentity} disabled={lockIdentity} />
        </Field>
        <Field label={t("bloodGroup")}>
          <select value={form.blood} onChange={set("blood")}>
            <option value="">{t("select")}</option>
            {BLOOD.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t("emailId")}>
        <input type="email" autoComplete="email" value={form.email} onChange={set("email")} readOnly={lockIdentity} disabled={lockIdentity} />
      </Field>
      {password}
    </section>
  );
}

function AddressBlock({ title, value, onChange }) {
  const { t } = useI18n();
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <div className="profile-block">
      <h3>{title}</h3>
      <div className="row">
        {ADDRESS_FIELDS.map(([key, label]) => (
          <Field key={key} label={t(label)}>
            <input inputMode={key === "pincode" ? "numeric" : undefined} value={value?.[key] || ""} onChange={set(key)} />
          </Field>
        ))}
      </div>
    </div>
  );
}

export function AddressFields({ form, setForm }) {
  const { t } = useI18n();
  return (
    <section>
      <h2>{t("address")}</h2>
      <p className="sub">{t("addressHint")}</p>
      <AddressBlock
        title={t("currentAddress")}
        value={form.curAddress}
        onChange={(curAddress) => setForm((current) => ({ ...current, curAddress }))}
      />
      <div className="inline-action">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setForm((current) => ({ ...current, nativeAddress: { ...current.curAddress } }))}
        >
          {t("nativeSame")}
        </button>
      </div>
      <AddressBlock
        title={t("nativeAddress")}
        value={form.nativeAddress}
        onChange={(nativeAddress) => setForm((current) => ({ ...current, nativeAddress }))}
      />
    </section>
  );
}

function JobBlock({ title, value, onChange, contact }) {
  const { t } = useI18n();
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <div className="profile-block">
      <h3>{title}</h3>
      <Field label={t("companyName")}><input value={value.orgName} onChange={set("orgName")} /></Field>
      <div className="row">
        <Field label={t("designation")}><input value={value.designation} onChange={set("designation")} /></Field>
        <Field label={t("orgType")}><input value={value.orgType} onChange={set("orgType")} /></Field>
      </div>
      {contact && (
        <Field label={t("addressPhoneEmail")}>
          <textarea value={value.contact} onChange={set("contact")} />
        </Field>
      )}
    </div>
  );
}

function StudyBlock({ title, value, onChange }) {
  const { t } = useI18n();
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <div className="profile-block">
      <h3>{title}</h3>
      <Field label={t("collegeName")}><input value={value.name} onChange={set("name")} /></Field>
      <div className="row">
        <Field label={t("year")}><input inputMode="numeric" value={value.year} onChange={set("year")} /></Field>
        <Field label={t("department")}><input value={value.department} onChange={set("department")} /></Field>
      </div>
    </div>
  );
}

export function FamilyFields({ form, setForm }) {
  const { t } = useI18n();
  const { set, setRow } = binders(setForm);
  return (
    <section>
      <h2>{t("family")}</h2>
      <p className="sub">{t("familyHint")}</p>
      <div className="row">
        <Field label={t("fathersName")}><input value={form.father} onChange={set("father")} /></Field>
        <Field label={t("mothersName")}><input value={form.mother} onChange={set("mother")} /></Field>
      </div>
      <div className="row">
        <Field label={t("fatherOccupation")}><input value={form.fatherOccupation} onChange={set("fatherOccupation")} /></Field>
        <Field label={t("motherOccupation")}><input value={form.motherOccupation} onChange={set("motherOccupation")} /></Field>
      </div>
      <div className="row">
        <Field label={t("fatherCompany")}><input value={form.fatherCompany} onChange={set("fatherCompany")} /></Field>
        <Field label={t("motherCompany")}><input value={form.motherCompany} onChange={set("motherCompany")} /></Field>
      </div>
      <div className="repeater">
        <div className="sec-h"><h3>{t("siblings")}</h3></div>
        {form.siblings.map((item, index) => (
          <div className="rep" key={index}>
            <div className="row">
              <Field label={t("siblingNameN", { n: index + 1 })}>
                <input value={item.name} onChange={setRow("siblings", index, "name")} />
              </Field>
              <Field label={t("gender")}>
                <select value={item.gender} onChange={setRow("siblings", index, "gender")}>
                  <option value="">{t("select")}</option>
                  <option value="Male">{t("genderMale")}</option>
                  <option value="Female">{t("genderFemale")}</option>
                </select>
              </Field>
            </div>
            <div className="row">
              <Field label={t("dateOfBirth")}>
                <input type="date" value={item.dob} onChange={setRow("siblings", index, "dob")} />
              </Field>
              <Field label={t("alumniId")}>
                <input value={item.alumniId} onChange={setRow("siblings", index, "alumniId")} />
              </Field>
            </div>
            <Field label={t("schoolOrOrg")}>
              <input value={item.org} onChange={setRow("siblings", index, "org")} />
            </Field>
          </div>
        ))}
      </div>
      <div className="repeater">
        <div className="sec-h">
          <div><h3>{t("otherSchool")}</h3></div>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setForm((current) => ({ ...current, otherSchools: [...current.otherSchools, { ...EMPTY_SCHOOL }] }))}
          >
            {t("addAnother")}
          </button>
        </div>
        {form.otherSchools.map((item, index) => (
          <div className="rep" key={index}>
            {form.otherSchools.length > 1 && (
              <button
                type="button"
                className="x"
                aria-label={t("removeItem", { title: t("otherSchool") })}
                onClick={() => setForm((current) => ({
                  ...current,
                  otherSchools: current.otherSchools.filter((_, i) => i !== index),
                }))}
              >
                ×
              </button>
            )}
            <Field label={t("schoolName")}>
              <input value={item.name} onChange={setRow("otherSchools", index, "name")} />
            </Field>
            <div className="row">
              <Field label={t("yearCompleted")}>
                <input inputMode="numeric" value={item.yearCompleted} onChange={setRow("otherSchools", index, "yearCompleted")} />
              </Field>
              <Field label={t("classLeaving")}>
                <input value={item.classLeaving} onChange={setRow("otherSchools", index, "classLeaving")} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorkFields({ form, setForm }) {
  const { t } = useI18n();
  const { set, setRow } = binders(setForm);
  const spouse = spouseLabelKeys(form.gender);
  const setJob = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const setStudy = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <section>
      <h2>{t("workStudy")}</h2>
      <p className="sub">{t("workLifeHint")}</p>
      <div className="row">
        <JobBlock title={t("currentJob")} value={form.currentJob} onChange={setJob("currentJob")} contact />
        <JobBlock title={t("previousJob")} value={form.previousJob} onChange={setJob("previousJob")} contact />
      </div>
      <div className="row">
        <StudyBlock title={t("collegeUg")} value={form.collegeUg} onChange={setStudy("collegeUg")} />
        <StudyBlock title={t("collegePg")} value={form.collegePg} onChange={setStudy("collegePg")} />
      </div>
      <div className="profile-block">
        <h3>{t("maritalStatus")}</h3>
        <div className="row">
          <Field label={t("maritalStatus")}>
            <select value={form.maritalStatus} onChange={set("maritalStatus")}>
              <option value="">{t("select")}</option>
              {MARITAL.map((item) => <option key={item} value={item}>{t(`marital${item}`)}</option>)}
            </select>
          </Field>
          <Field label={t(spouse.name)}><input value={form.spouseName} onChange={set("spouseName")} /></Field>
        </div>
        <div className="row">
          <Field label={t("kidsCount")}>
            <input inputMode="numeric" value={form.kidsCount} onChange={set("kidsCount")} />
          </Field>
          <Field label={t(spouse.occupation)}><input value={form.spouseOccupation} onChange={set("spouseOccupation")} /></Field>
        </div>
        <Field label={t(spouse.company)}><input value={form.spouseCompany} onChange={set("spouseCompany")} /></Field>
        {form.kids.map((item, index) => (
          <div className="rep" key={index}>
            <div className="row">
              <Field label={t("kidNameN", { n: index + 1 })}>
                <input value={item.name} onChange={setRow("kids", index, "name")} />
              </Field>
              <Field label={t("dateOfBirth")}>
                <input type="date" value={item.dob} onChange={setRow("kids", index, "dob")} />
              </Field>
            </div>
            <div className="row">
              <Field label={t("kidSchool")}>
                <input value={item.school} onChange={setRow("kids", index, "school")} />
              </Field>
              <Field label={t("classOrYear")}>
                <input value={item.classYear} onChange={setRow("kids", index, "classYear")} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
