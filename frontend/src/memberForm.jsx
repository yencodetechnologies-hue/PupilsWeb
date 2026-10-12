import { Children } from "react";
import { Avatar, PhotoPicker } from "./components";
import { BI, GENDER_BI, MARITAL_BI } from "./biLabels";
import { useI18n } from "./i18n";
import {
  BLOOD,
  COUNTRIES,
  EMPTY_KID,
  EMPTY_SCHOOL,
  EMPTY_SIBLING,
  INDIAN_STATES,
  MARITAL,
  addressLine,
  applyField,
  padList,
  spouseLabelKeys,
  spouseRelevant,
} from "./memberShape";

const ADDRESS_FIELDS = ["door", "street", "road", "area", "district", "state", "country", "pincode"];

function BiField({ en, ta, children, error }) {
  return (
    <label className="field bi-field">
      <span className="bi-label">
        <b>{en}</b>
        <small lang="ta">{ta}</small>
      </span>
      {children}
      {error ? <em className="field-err">{error}</em> : null}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="sheet-sec">
      <h2>{title[0]}</h2>
      <p className="ta" lang="ta">{title[1]}</p>
      {children}
    </section>
  );
}

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

function Choice({ value, options, onChange, placeholder }) {
  return (
    <select value={value || ""} onChange={onChange}>
      <option value="">{placeholder}</option>
      {value && !options.some((item) => (item.value || item) === value) && <option value={value}>{value}</option>}
      {options.map((item) => {
        const optionValue = item.value || item;
        const label = item.label || item;
        return <option key={optionValue} value={optionValue}>{label}</option>;
      })}
    </select>
  );
}

export function BatchYearSelect({ value, years, onChange, placeholder }) {
  const { t } = useI18n();
  const list = [...(years || [])];
  const known = list.map(Number);
  return (
    <select value={value} onChange={onChange}>
      <option value="">{placeholder || t("select")}</option>
      {value && !known.includes(Number(value)) && <option value={value}>{value}</option>}
      {list.sort((a, b) => b - a).map((year) => <option key={year} value={year}>{t("batchTag", { year })}</option>)}
    </select>
  );
}

function StateInput({ value, country, onChange }) {
  if (country && country !== "India") {
    return <input value={value || ""} onChange={onChange} />;
  }
  return (
    <Choice
      value={value}
      onChange={onChange}
      placeholder="Select / தேர்வு"
      options={INDIAN_STATES}
    />
  );
}

function AddressBlock({ title, group, value, onChange, issueFor }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <Section title={title}>
      <div className="sheet-grid">
        {ADDRESS_FIELDS.map((key) => (
          <BiField key={key} en={BI[key][0]} ta={BI[key][1]} error={issueFor(`${group}.${key}`)}>
            {key === "state" ? (
              <StateInput value={value?.[key]} country={value?.country} onChange={set(key)} />
            ) : key === "country" ? (
              <Choice value={value?.[key]} onChange={set(key)} placeholder="Select / தேர்வு" options={COUNTRIES} />
            ) : (
              <input inputMode={key === "pincode" ? "numeric" : undefined} value={value?.[key] || ""} onChange={set(key)} />
            )}
          </BiField>
        ))}
      </div>
    </Section>
  );
}

function JobBlock({ title, group, value, onChange, issueFor }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <Section title={title}>
      <div className="sheet-grid">
        <BiField en={BI.orgName[0]} ta={BI.orgName[1]}><input value={value.orgName || ""} onChange={set("orgName")} /></BiField>
        <BiField en={BI.designation[0]} ta={BI.designation[1]}><input value={value.designation || ""} onChange={set("designation")} /></BiField>
        <BiField en={BI.orgType[0]} ta={BI.orgType[1]}><input value={value.orgType || ""} onChange={set("orgType")} /></BiField>
        <BiField en={BI.contactPhone[0]} ta={BI.contactPhone[1]} error={issueFor(`${group}.phone`)}>
          <input inputMode="tel" value={value.phone || ""} onChange={set("phone")} />
        </BiField>
        <BiField en={BI.orgAddress[0]} ta={BI.orgAddress[1]}>
          <textarea value={value.address || ""} onChange={set("address")} />
        </BiField>
        <BiField en={BI.emailAddress[0]} ta={BI.emailAddress[1]} error={issueFor(`${group}.email`)}>
          <input type="email" value={value.email || ""} onChange={set("email")} />
        </BiField>
      </div>
    </Section>
  );
}

function StudyBlock({ title, value, onChange }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <Section title={title}>
      <div className="sheet-grid">
        <BiField en={BI.collegeName[0]} ta={BI.collegeName[1]}><input value={value.name || ""} onChange={set("name")} /></BiField>
        <BiField en={BI.year[0]} ta={BI.year[1]}><input inputMode="numeric" value={value.year || ""} onChange={set("year")} /></BiField>
        <BiField en={BI.department[0]} ta={BI.department[1]}><input value={value.department || ""} onChange={set("department")} /></BiField>
      </div>
    </Section>
  );
}

export function RegistrationSheet({
  form,
  setForm,
  batches,
  lockIdentity,
  issues,
  photo,
  photoFile,
  onPhoto,
  onClearPhoto,
  identity,
  institutionName,
}) {
  const { set, setRow } = binders(setForm);
  const issueFor = (key) => issues?.[key] || "";
  const spouse = spouseLabelKeys(form.gender);
  const showSpouse = spouseRelevant(form.maritalStatus);
  const setJob = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const setStudy = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const setAddress = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const setKidsCount = (event) => {
    const raw = event.target.value.replace(/\D/g, "").slice(0, 2);
    setForm((current) => {
      if (raw === "") return { ...current, kidsCount: "" };
      const count = Math.min(12, Number(raw));
      return { ...current, kidsCount: raw, kids: padList(current.kids, EMPTY_KID, count) };
    });
  };

  return (
    <div className="reg-sheet" id="registration-sheet">
      <header className="print-only sheet-print-head">
        <strong>{institutionName || "Alumni registration"}</strong>
        <span>{form.name}</span>
      </header>
      <Section title={BI.personal}>
        <div className="no-print">
          <PhotoPicker name={form.name} photo={photo} file={photoFile} onFile={onPhoto} onClear={onClearPhoto} />
        </div>
        <div className="sheet-grid">
          <BiField en={BI.memberNo[0]} ta={BI.memberNo[1]}>
            <input value={form.memberNo} readOnly disabled placeholder="Assigned automatically / தானாக வழங்கப்படும்" />
          </BiField>
          <BiField en={BI.yearJoined[0]} ta={BI.yearJoined[1]} error={issueFor("batch")}>
            <input inputMode="numeric" placeholder="2001" value={form.batch} onChange={set("batch")} />
          </BiField>
          <BiField en={BI.yearCompleted[0]} ta={BI.yearCompleted[1]}>
            <BatchYearSelect value={form.yearCompleted} years={batches} onChange={set("yearCompleted")} placeholder="Select / தேர்வு" />
          </BiField>
          <BiField en={BI.classLeaving[0]} ta={BI.classLeaving[1]}>
            <input value={form.classLeaving} onChange={set("classLeaving")} />
          </BiField>
          <BiField en={BI.name[0]} ta={BI.name[1]} error={issueFor("name")}>
            <input autoComplete="name" value={form.name} onChange={set("name")} readOnly={lockIdentity} disabled={lockIdentity} />
          </BiField>
          <BiField en={BI.age[0]} ta={BI.age[1]}>
            <input inputMode="numeric" value={form.age} onChange={set("age")} />
          </BiField>
          <BiField en={BI.gender[0]} ta={BI.gender[1]}>
            <Choice
              value={form.gender}
              onChange={set("gender")}
              placeholder="Select / தேர்வு"
              options={Object.entries(GENDER_BI).map(([value, label]) => ({ value, label }))}
            />
          </BiField>
          <BiField en={BI.dob[0]} ta={BI.dob[1]} error={issueFor("dob")}>
            <input type="date" value={form.dob} onChange={set("dob")} />
          </BiField>
          <BiField en={BI.mobile[0]} ta={BI.mobile[1]} error={issueFor("mobile")}>
            <input inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} readOnly={lockIdentity} disabled={lockIdentity} />
          </BiField>
          <BiField en={BI.blood[0]} ta={BI.blood[1]}>
            <Choice value={form.blood} onChange={set("blood")} placeholder="Select / தேர்வு" options={BLOOD} />
          </BiField>
          <BiField en={BI.email[0]} ta={BI.email[1]} error={issueFor("email")}>
            <input type="email" autoComplete="email" value={form.email} onChange={set("email")} readOnly={lockIdentity} disabled={lockIdentity} />
          </BiField>
        </div>
        {identity}
      </Section>

      <AddressBlock
        title={BI.currentAddress}
        group="curAddress"
        value={form.curAddress}
        onChange={setAddress("curAddress")}
        issueFor={issueFor}
      />
      <div className="inline-action no-print">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setForm((current) => ({ ...current, nativeAddress: { ...current.curAddress } }))}
        >
          Permanent same as current / நிரந்தர முகவரி தற்போதைய முகவரி போலவே
        </button>
      </div>
      <AddressBlock
        title={BI.permanentAddress}
        group="nativeAddress"
        value={form.nativeAddress}
        onChange={setAddress("nativeAddress")}
        issueFor={issueFor}
      />

      <Section title={BI.parents}>
        <h3 className="sheet-sub">{BI.father[0]} <small lang="ta">{BI.father[1]}</small></h3>
        <div className="sheet-grid">
          <BiField en={BI.fatherName[0]} ta={BI.fatherName[1]} error={issueFor("father")}><input value={form.father} onChange={set("father")} /></BiField>
          <BiField en={BI.fatherOccupation[0]} ta={BI.fatherOccupation[1]}><input value={form.fatherOccupation} onChange={set("fatherOccupation")} /></BiField>
          <BiField en={BI.fatherCompany[0]} ta={BI.fatherCompany[1]}><input value={form.fatherCompany} onChange={set("fatherCompany")} /></BiField>
        </div>
        <h3 className="sheet-sub">{BI.mother[0]} <small lang="ta">{BI.mother[1]}</small></h3>
        <div className="sheet-grid">
          <BiField en={BI.motherName[0]} ta={BI.motherName[1]} error={issueFor("mother")}><input value={form.mother} onChange={set("mother")} /></BiField>
          <BiField en={BI.motherOccupation[0]} ta={BI.motherOccupation[1]}><input value={form.motherOccupation} onChange={set("motherOccupation")} /></BiField>
          <BiField en={BI.motherCompany[0]} ta={BI.motherCompany[1]}><input value={form.motherCompany} onChange={set("motherCompany")} /></BiField>
        </div>
      </Section>

      <Section title={BI.siblings}>
        <div className="sec-h no-print">
          <span />
          <button
            type="button"
            className="btn ghost sm"
            disabled={form.siblings.length >= 12}
            onClick={() => setForm((current) => ({ ...current, siblings: [...current.siblings, { ...EMPTY_SIBLING }] }))}
          >
            Add sibling / உடன்பிறப்பைச் சேர்
          </button>
        </div>
        {form.siblings.map((item, index) => (
          <div className="rep" key={`sib-${index}`}>
            {form.siblings.length > 0 && (
              <button
                type="button"
                className="x no-print"
                aria-label={`Remove sibling ${index + 1}`}
                onClick={() => setForm((current) => ({
                  ...current,
                  siblings: current.siblings.filter((_, i) => i !== index),
                }))}
              >
                ×
              </button>
            )}
            <div className="sheet-grid">
              <BiField en={`${BI.siblingName[0]} ${index + 1}`} ta={BI.siblingName[1]}>
                <input value={item.name} onChange={setRow("siblings", index, "name")} />
              </BiField>
              <BiField en={BI.siblingGender[0]} ta={BI.siblingGender[1]}>
                <Choice
                  value={item.gender}
                  onChange={setRow("siblings", index, "gender")}
                  placeholder="Select / தேர்வு"
                  options={[
                    { value: "Male", label: GENDER_BI.Male },
                    { value: "Female", label: GENDER_BI.Female },
                  ]}
                />
              </BiField>
              <BiField en={BI.dob[0]} ta={BI.dob[1]} error={issueFor(`siblings.${index}.dob`)}>
                <input type="date" value={item.dob} onChange={setRow("siblings", index, "dob")} />
              </BiField>
              <BiField en={BI.alumniId[0]} ta={BI.alumniId[1]}>
                <input value={item.alumniId} onChange={setRow("siblings", index, "alumniId")} />
              </BiField>
              <BiField en={BI.schoolOrg[0]} ta={BI.schoolOrg[1]}>
                <input value={item.org} onChange={setRow("siblings", index, "org")} />
              </BiField>
            </div>
          </div>
        ))}
      </Section>

      <Section title={BI.previousSchool}>
        <div className="sec-h no-print">
          <span />
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setForm((current) => ({ ...current, otherSchools: [...current.otherSchools, { ...EMPTY_SCHOOL }] }))}
          >
            Add school / பள்ளியைச் சேர்
          </button>
        </div>
        {form.otherSchools.map((item, index) => (
          <div className="rep" key={`school-${index}`}>
            {form.otherSchools.length > 1 && (
              <button
                type="button"
                className="x no-print"
                aria-label={`Remove school ${index + 1}`}
                onClick={() => setForm((current) => ({
                  ...current,
                  otherSchools: current.otherSchools.filter((_, i) => i !== index),
                }))}
              >
                ×
              </button>
            )}
            <div className="sheet-grid">
              <BiField en={BI.schoolName[0]} ta={BI.schoolName[1]}>
                <input value={item.name} onChange={setRow("otherSchools", index, "name")} />
              </BiField>
              <BiField en={BI.yearCompleted[0]} ta={BI.yearCompleted[1]}>
                <input inputMode="numeric" value={item.yearCompleted} onChange={setRow("otherSchools", index, "yearCompleted")} />
              </BiField>
              <BiField en={BI.classLeaving[0]} ta={BI.classLeaving[1]}>
                <input value={item.classLeaving} onChange={setRow("otherSchools", index, "classLeaving")} />
              </BiField>
            </div>
          </div>
        ))}
      </Section>

      <div className="sheet-pair">
        <JobBlock title={BI.currentJob} group="currentJob" value={form.currentJob} onChange={setJob("currentJob")} issueFor={issueFor} />
        <JobBlock title={BI.previousJob} group="previousJob" value={form.previousJob} onChange={setJob("previousJob")} issueFor={issueFor} />
      </div>
      <div className="sheet-pair">
        <StudyBlock title={BI.ug} value={form.collegeUg} onChange={setStudy("collegeUg")} />
        <StudyBlock title={BI.pg} value={form.collegePg} onChange={setStudy("collegePg")} />
      </div>

      <Section title={BI.marital}>
        <div className="sheet-grid">
          <BiField en={BI.maritalStatus[0]} ta={BI.maritalStatus[1]}>
            <Choice
              value={form.maritalStatus}
              onChange={set("maritalStatus")}
              placeholder="Select / தேர்வு"
              options={MARITAL.map((value) => ({ value, label: MARITAL_BI[value] }))}
            />
          </BiField>
          <BiField en={BI.kidsCount[0]} ta={BI.kidsCount[1]}>
            <input inputMode="numeric" value={form.kidsCount} onChange={setKidsCount} />
          </BiField>
          {showSpouse && (
            <>
              <BiField en={BI[spouse.name][0]} ta={BI[spouse.name][1]}>
                <input value={form.spouseName} onChange={set("spouseName")} />
              </BiField>
              <BiField en={BI[spouse.occupation][0]} ta={BI[spouse.occupation][1]}>
                <input value={form.spouseOccupation} onChange={set("spouseOccupation")} />
              </BiField>
              <BiField en={BI[spouse.company][0]} ta={BI[spouse.company][1]}>
                <input value={form.spouseCompany} onChange={set("spouseCompany")} />
              </BiField>
            </>
          )}
        </div>
      </Section>

      <Section title={BI.children}>
        <div className="sec-h no-print">
          <span />
          <button
            type="button"
            className="btn ghost sm"
            disabled={form.kids.length >= 12}
            onClick={() => setForm((current) => {
              const kids = [...current.kids, { ...EMPTY_KID }];
              return { ...current, kids, kidsCount: String(kids.length) };
            })}
          >
            Add child / குழந்தையைச் சேர்
          </button>
        </div>
        {form.kids.map((item, index) => (
          <div className="rep" key={`kid-${index}`}>
            <button
              type="button"
              className="x no-print"
              aria-label={`Remove child ${index + 1}`}
              onClick={() => setForm((current) => {
                const kids = current.kids.filter((_, i) => i !== index);
                return { ...current, kids, kidsCount: kids.length ? String(kids.length) : "" };
              })}
            >
              ×
            </button>
            <div className="sheet-grid">
              <BiField en={`${BI.childName[0]} ${index + 1}`} ta={BI.childName[1]}>
                <input value={item.name} onChange={setRow("kids", index, "name")} />
              </BiField>
              <BiField en={BI.dob[0]} ta={BI.dob[1]} error={issueFor(`kids.${index}.dob`)}>
                <input type="date" value={item.dob} onChange={setRow("kids", index, "dob")} />
              </BiField>
              <BiField en={BI.childSchool[0]} ta={BI.childSchool[1]}>
                <input value={item.school} onChange={setRow("kids", index, "school")} />
              </BiField>
              <BiField en={BI.classYear[0]} ta={BI.classYear[1]}>
                <input value={item.classYear} onChange={setRow("kids", index, "classYear")} />
              </BiField>
            </div>
          </div>
        ))}
      </Section>
      <p className="print-foot" aria-hidden="true">{institutionName || "Alumni registration"}</p>
    </div>
  );
}

function Line({ en, ta, value }) {
  if (!value) return null;
  return (
    <div className="rec-line">
      <dt><b>{en}</b><small lang="ta">{ta}</small></dt>
      <dd>{value}</dd>
    </div>
  );
}

function Block({ title, children }) {
  const items = Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="sheet-sec">
      <h2>{title[0]}</h2>
      <p className="ta" lang="ta">{title[1]}</p>
      <div className="rec">{items}</div>
    </section>
  );
}

function jobLines(job) {
  if (!job) return [];
  const address = job.address || (!job.phone && !job.email ? job.contact : "");
  return [
    [BI.orgName, job.orgName],
    [BI.designation, job.designation],
    [BI.orgType, job.orgType],
    [BI.orgAddress, address],
    [BI.contactPhone, job.phone],
    [BI.emailAddress, job.email],
  ];
}

export function ProfileRecord({ member, institutionName }) {
  const spouse = spouseLabelKeys(member.gender);
  const currentAddress = addressLine(member.curAddress) || member.curAddr;
  const nativeAddress = addressLine(member.nativeAddress) || member.nativeAddr;
  const schools = (member.otherSchools || []).filter((item) => item.name || item.yearCompleted || item.classLeaving);
  const siblings = (member.siblings || []).filter((item) => item.name || item.org);
  const kids = (member.kids || []).filter((item) => item.name || item.school);
  const showSpouse = spouseRelevant(member.maritalStatus);
  return (
    <div className="reg-sheet profile-record" id="registration-sheet">
      <header className="print-only sheet-print-head">
        <strong>{institutionName || "Alumni registration"}</strong>
        <span>{member.name}</span>
      </header>
      <div className="d-top">
        <Avatar name={member.name} photo={member.photo} large />
        <div>
          <h2>{member.name}</h2>
          <p className="ta" lang="ta">{BI.name[1]}</p>
          {member.batch ? <span className="tag">Batch {member.batch} / தொகுதி {member.batch}</span> : null}
        </div>
      </div>
      <Block title={BI.personal}>
        <Line en={BI.memberNo[0]} ta={BI.memberNo[1]} value={member.memberNo} />
        <Line en={BI.yearJoined[0]} ta={BI.yearJoined[1]} value={member.batch ? String(member.batch) : ""} />
        <Line en={BI.yearCompleted[0]} ta={BI.yearCompleted[1]} value={member.yearCompleted} />
        <Line en={BI.classLeaving[0]} ta={BI.classLeaving[1]} value={member.classLeaving} />
        <Line en={BI.age[0]} ta={BI.age[1]} value={member.age} />
        <Line en={BI.gender[0]} ta={BI.gender[1]} value={GENDER_BI[member.gender] || member.gender} />
        <Line en={BI.dob[0]} ta={BI.dob[1]} value={member.dob} />
        <Line en={BI.mobile[0]} ta={BI.mobile[1]} value={member.mobile} />
        <Line en={BI.blood[0]} ta={BI.blood[1]} value={member.blood} />
        <Line en={BI.email[0]} ta={BI.email[1]} value={member.email} />
      </Block>
      <Block title={BI.currentAddress}>
        <Line en={BI.currentAddress[0]} ta={BI.currentAddress[1]} value={currentAddress} />
      </Block>
      <Block title={BI.permanentAddress}>
        <Line en={BI.permanentAddress[0]} ta={BI.permanentAddress[1]} value={nativeAddress} />
      </Block>
      <Block title={BI.parents}>
        <Line en={BI.fatherName[0]} ta={BI.fatherName[1]} value={member.father} />
        <Line en={BI.fatherOccupation[0]} ta={BI.fatherOccupation[1]} value={member.fatherOccupation} />
        <Line en={BI.fatherCompany[0]} ta={BI.fatherCompany[1]} value={member.fatherCompany} />
        <Line en={BI.motherName[0]} ta={BI.motherName[1]} value={member.mother} />
        <Line en={BI.motherOccupation[0]} ta={BI.motherOccupation[1]} value={member.motherOccupation} />
        <Line en={BI.motherCompany[0]} ta={BI.motherCompany[1]} value={member.motherCompany} />
      </Block>
      {!!siblings.length && (
        <Section title={BI.siblings}>
          {siblings.map((item, index) => (
            <div className="mini" key={`sib-${index}`}>
              <b>{item.name}</b>
              <small>{[GENDER_BI[item.gender] || item.gender, item.dob, item.org, item.alumniId].filter(Boolean).join(" · ")}</small>
            </div>
          ))}
        </Section>
      )}
      {!!schools.length && (
        <Section title={BI.previousSchool}>
          {schools.map((item, index) => (
            <div className="mini" key={`school-${index}`}>
              <b>{item.name}</b>
              <small>{[item.yearCompleted, item.classLeaving].filter(Boolean).join(" · ")}</small>
            </div>
          ))}
        </Section>
      )}
      <Block title={BI.currentJob}>
        {jobLines(member.currentJob).map(([label, value]) => (
          <Line key={label[0]} en={label[0]} ta={label[1]} value={value} />
        ))}
      </Block>
      <Block title={BI.previousJob}>
        {jobLines(member.previousJob).map(([label, value]) => (
          <Line key={label[0]} en={label[0]} ta={label[1]} value={value} />
        ))}
      </Block>
      <Block title={BI.ug}>
        <Line en={BI.collegeName[0]} ta={BI.collegeName[1]} value={member.collegeUg?.name} />
        <Line en={BI.year[0]} ta={BI.year[1]} value={member.collegeUg?.year} />
        <Line en={BI.department[0]} ta={BI.department[1]} value={member.collegeUg?.department} />
      </Block>
      <Block title={BI.pg}>
        <Line en={BI.collegeName[0]} ta={BI.collegeName[1]} value={member.collegePg?.name} />
        <Line en={BI.year[0]} ta={BI.year[1]} value={member.collegePg?.year} />
        <Line en={BI.department[0]} ta={BI.department[1]} value={member.collegePg?.department} />
      </Block>
      <Block title={BI.marital}>
        <Line en={BI.maritalStatus[0]} ta={BI.maritalStatus[1]} value={MARITAL_BI[member.maritalStatus] || member.maritalStatus} />
        {showSpouse && <Line en={BI[spouse.name][0]} ta={BI[spouse.name][1]} value={member.spouseName} />}
        {showSpouse && <Line en={BI[spouse.occupation][0]} ta={BI[spouse.occupation][1]} value={member.spouseOccupation} />}
        {showSpouse && <Line en={BI[spouse.company][0]} ta={BI[spouse.company][1]} value={member.spouseCompany} />}
        <Line en={BI.kidsCount[0]} ta={BI.kidsCount[1]} value={member.kidsCount} />
      </Block>
      {!!kids.length && (
        <Section title={BI.children}>
          {kids.map((item, index) => (
            <div className="mini" key={`kid-${index}`}>
              <b>{item.name}</b>
              <small>{[item.dob, item.school, item.classYear].filter(Boolean).join(" · ")}</small>
            </div>
          ))}
        </Section>
      )}
      <p className="print-foot" aria-hidden="true">{institutionName || "Alumni registration"}</p>
    </div>
  );
}
