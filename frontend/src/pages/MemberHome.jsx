import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, uploadPhoto } from "../api";
import { Avatar, Brand, ErrBox, Field, MemberProfile, PasswordField, PhotoPicker } from "../components";
import { LangToggle, useI18n } from "../i18n";
import { useAuth, useToast } from "../state";

export function MemberHome() {
  const { t } = useI18n();
  const { session, setSession, updateMember } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const member = session.member;
  const inst = session.institution;
  const [mates, setMates] = useState([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api("/api/me/batchmates")
      .then((data) => setMates(data.batchmates))
      .catch(() => setMates([]));
  }, [member.batch]);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    navigate("/");
  };

  const removeAccount = async () => {
    if (!window.confirm(t("deleteConfirm", { email: member.email }))) return;
    setDeleting(true);
    try {
      await api("/api/me", { method: "DELETE" });
      setSession(null);
      toast(t("accountDeleted"));
      navigate("/");
    } catch (error) {
      toast(error.message);
      setDeleting(false);
    }
  };

  return (
    <div className="join-wrap member-home">
      <header className="join-hero">
        <LangToggle />
        <Brand />
        <p className="eyebrow light">{member.name}</p>
        <h1>{inst?.name || t("yourInstitution")}</h1>
        <p>{mates.length === 1 ? t("batchmateHere", { year: member.batch }) : t("batchmatesHere", { year: member.batch, n: mates.length })}</p>
      </header>
      <div className="join-body stack">
        <section className="card profile-card">
          <div className="sec-h">
            <h2>{t("yourProfile")}</h2>
            <button className="btn ghost sm" onClick={() => setEditing((open) => !open)}>{editing ? t("close") : t("editProfile")}</button>
          </div>
          {editing ? (
            <EditProfile member={member} code={inst?.code} onSaved={(next) => { updateMember(next); setEditing(false); toast(t("profileSaved")); }} />
          ) : (
            <MemberProfile member={member} />
          )}
          <div className="d-sec">
            <h3>{t("account")}</h3>
            <p className="sub">{t("deleteHint")}</p>
            <button className="btn danger" disabled={deleting} onClick={removeAccount}>{deleting ? t("deleting") : t("deleteAccount")}</button>
          </div>
        </section>
        <section className="card">
          <h2>{t("yourBatchmates")}</h2>
          {mates.length ? (
            <div className="mate-grid">
              {mates.map((mate) => (
                <article className="mate" key={mate.id}>
                  <Avatar name={mate.name} photo={mate.photo} />
                  <b>{mate.name}</b>
                  <small>{[mate.city, mate.occupation || mate.qualification].filter(Boolean).join(" · ") || t("batchmate")}</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">{t("noBatchmates")}</p>
          )}
        </section>
        <button className="btn ghost" onClick={logout}>{t("signOut")}</button>
      </div>
    </div>
  );
}

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));
const BLANKS = {
  schools: { name: "", board: "", from: "", to: "" },
  colleges: { name: "", degree: "", from: "", to: "" },
  businesses: { name: "", industry: "", role: "", city: "", phone: "", web: "", desc: "" },
  links: { label: "", url: "" },
};
const fillList = (items, blank) => (items?.length ? items.map((item) => ({ ...blank, ...item })) : []);

function EditProfile({ member, code, onSaved }) {
  const { t } = useI18n();
  const { updateMember } = useAuth();
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState({
    batch: String(member.batch || ""),
    name: member.name || "",
    email: member.email || "",
    mobile: member.mobile || "",
    father: member.father || "",
    mother: member.mother || "",
    city: member.city || "",
    qualification: member.qualification || "",
    occupation: member.occupation || "",
    dob: member.dob || "",
    gender: member.gender || "",
    blood: member.blood || "",
    curAddr: member.curAddr || "",
    nativeAddr: member.nativeAddr || "",
  });
  const [schools, setSchools] = useState(fillList(member.schools, BLANKS.schools));
  const [colleges, setColleges] = useState(fillList(member.colleges, BLANKS.colleges));
  const [businesses, setBusinesses] = useState(fillList(member.businesses, BLANKS.businesses));
  const [links, setLinks] = useState(fillList(member.links, BLANKS.links));
  const [currentPw, setCurrentPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [photo, setPhoto] = useState(member.photo || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!code) return;
    api(`/api/join/${code}`)
      .then((data) => setBatches(data.institution?.batches || []))
      .catch(() => setBatches([]));
  }, [code]);

  const storePhoto = async (file) => {
    setBusy(true);
    setErr("");
    try {
      const uploaded = await uploadPhoto(file, { save: true });
      setPhoto(uploaded.photo || "");
      setPhotoFile(null);
      if (uploaded.member) updateMember(uploaded.member);
    } catch (error) {
      setPhotoFile(null);
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const clearPhoto = async () => {
    setPhotoFile(null);
    setPhoto("");
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/me", {
        method: "PATCH",
        body: { photo: "", photoId: "" },
      });
      updateMember(data.member);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setErr(t("enterName"));
    if (!isEmail(form.email)) return setErr(t("badEmail"));
    if (!isMobile(form.mobile)) return setErr(t("badMobile"));
    if (!form.batch) return setErr(t("selectBatch"));
    if (!form.father.trim() || !form.mother.trim()) return setErr(t("enterParents"));
    if (!form.city.trim()) return setErr(t("enterCity"));
    if (!form.qualification.trim()) return setErr(t("enterQual"));
    const changingPassword = currentPw || pw || pw2;
    if (changingPassword) {
      if (!currentPw) return setErr(t("needCurrentPw"));
      if (pw.length < 6) return setErr(t("newPwShort"));
      if (pw !== pw2) return setErr(t("pwMismatch"));
    }
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/me", {
        method: "PATCH",
        body: {
          ...form,
          schools,
          colleges,
          businesses,
          links,
          ...(changingPassword ? { currentPw, pw } : {}),
        },
      });
      onSaved({ ...data.member, photo: data.member.photo || photo });
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={save} noValidate>
      <ErrBox msg={err} />
      <p className="sub">{t("editSeeHint")}</p>
      <PhotoPicker
        name={form.name || member.name}
        photo={photo}
        file={photoFile}
        onFile={(file, message) => {
          if (message) {
            setErr(message);
            return;
          }
          setErr("");
          setPhotoFile(file);
          storePhoto(file);
        }}
        onClear={clearPhoto}
      />
      <Field label={t("fullName")}><input autoComplete="name" value={form.name} onChange={set("name")} /></Field>
      <div className="row">
        <Field label={t("emailId")}><input type="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
        <Field label={t("mobileNumber")}><input inputMode="tel" autoComplete="tel" value={form.mobile} onChange={set("mobile")} /></Field>
      </div>
      <Field label={t("batch")}>
        <select value={form.batch} onChange={set("batch")}>
          {!batches.includes(Number(form.batch)) && form.batch && <option value={form.batch}>{t("batchTag", { year: form.batch })}</option>}
          {[...batches].sort((a, b) => b - a).map((year) => <option key={year} value={year}>{t("batchTag", { year })}</option>)}
        </select>
      </Field>

      <div className="profile-block">
        <h3>{t("aboutYou")}</h3>
        <div className="row">
          <Field label={t("fathersName")}><input value={form.father} onChange={set("father")} /></Field>
          <Field label={t("mothersName")}><input value={form.mother} onChange={set("mother")} /></Field>
        </div>
        <div className="row3">
          <Field label={t("dateOfBirth")}><input type="date" value={form.dob} onChange={set("dob")} /></Field>
          <Field label={t("gender")}>
            <select value={form.gender} onChange={set("gender")}>
              <option value="">{t("select")}</option>
              <option value="Male">{t("genderMale")}</option>
              <option value="Female">{t("genderFemale")}</option>
              <option value="Prefer not to say">{t("genderSkip")}</option>
            </select>
          </Field>
          <Field label={t("bloodGroup")}>
            <select value={form.blood} onChange={set("blood")}>
              <option value="">{t("select")}</option>
              {BLOOD.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="profile-block">
        <h3>{t("address")}</h3>
        <Field label={t("currentCity")}><input value={form.city} onChange={set("city")} /></Field>
        <Field label={t("currentAddress")}><textarea value={form.curAddr} onChange={set("curAddr")} /></Field>
        <div className="inline-action">
          <button type="button" className="btn ghost sm" onClick={() => setForm((current) => ({ ...current, nativeAddr: current.curAddr }))}>{t("nativeSame")}</button>
        </div>
        <Field label={t("nativeAddress")}><textarea value={form.nativeAddr} onChange={set("nativeAddr")} /></Field>
      </div>

      <div className="profile-block">
        <h3>{t("workStudy")}</h3>
        <div className="row">
          <Field label={t("highestQual")}><input value={form.qualification} onChange={set("qualification")} /></Field>
          <Field label={t("currentOccupation")}><input value={form.occupation} onChange={set("occupation")} /></Field>
        </div>
        <ListEditor title={t("schools")} addLabel={t("addSchool")} items={schools} setItems={setSchools} blank={BLANKS.schools} fields={[["name", t("schoolName")], ["board", t("board")], ["from", t("fromYear")], ["to", t("toYear")]]} />
        <ListEditor title={t("colleges")} addLabel={t("addCollege")} items={colleges} setItems={setColleges} blank={BLANKS.colleges} fields={[["name", t("collegeName")], ["degree", t("degree")], ["from", t("fromYear")], ["to", t("toYear")]]} />
        <ListEditor title={t("business")} addLabel={t("addBusiness")} items={businesses} setItems={setBusinesses} blank={BLANKS.businesses} fields={[["name", t("businessName")], ["role", t("yourRole")], ["industry", t("industry")], ["city", t("city")], ["phone", t("phone")], ["web", t("website")], ["desc", t("about")]]} />
        <ListEditor title={t("links")} addLabel={t("addALink")} items={links} setItems={setLinks} blank={BLANKS.links} fields={[["label", t("label")], ["url", t("url")]]} />
      </div>

      <div className="profile-block">
        <h3>{t("changePassword")}</h3>
        <p className="sub">{t("passwordNext")}</p>
        <PasswordField label={t("currentPassword")} autoComplete="current-password" placeholder={t("currentPassword")} value={currentPw} onChange={(event) => setCurrentPw(event.target.value)} />
        <div className="row">
          <PasswordField label={t("newPassword")} autoComplete="new-password" value={pw} onChange={(event) => setPw(event.target.value)} />
          <PasswordField label={t("confirmNewPassword")} autoComplete="new-password" value={pw2} onChange={(event) => setPw2(event.target.value)} />
        </div>
      </div>
      <div className="profile-save">
        <button className="btn brass" disabled={busy}>{busy ? t("saving") : t("saveProfile")}</button>
      </div>
    </form>
  );
}

function ListEditor({ title, addLabel, items, setItems, blank, fields }) {
  const { t } = useI18n();
  const update = (index, key, value) => setItems(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  return (
    <div className="repeater">
      <div className="sec-h">
        <h3>{title}</h3>
        <button type="button" className="btn ghost sm" onClick={() => setItems([...items, { ...blank }])}>{addLabel}</button>
      </div>
      {items.map((item, index) => (
        <div className="rep" key={index}>
          <button type="button" className="x" aria-label={t("removeItem", { title })} onClick={() => setItems(items.filter((_, i) => i !== index))}>×</button>
          <div className="row">
            {fields.map(([key, label]) => (
              <Field key={key} label={label}>
                <input value={item[key] || ""} onChange={(event) => update(index, key, event.target.value)} />
              </Field>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
