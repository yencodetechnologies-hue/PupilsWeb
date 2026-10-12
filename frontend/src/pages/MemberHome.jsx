import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, uploadPhoto } from "../api";
import { Avatar, Brand, ErrBox, Field, MemberProfile, PasswordField, PhotoPicker } from "../components";
import { LangToggle, useI18n } from "../i18n";
import { AddressFields, FamilyFields, MembershipFields, WorkFields } from "../memberForm";
import { formFromMember } from "../memberShape";
import { useAuth, useToast } from "../state";

export function MemberHome() {
  const { t } = useI18n();
  const { session, setSession, updateMember } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const member = session.member;
  const inst = session.institution;
  const unfinished = needsProfile(member);
  const [mates, setMates] = useState([]);
  const [editing, setEditing] = useState(false);
  const showWizard = unfinished || editing;

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
            <h2>{showWizard && unfinished ? t("completeProfile") : t("yourProfile")}</h2>
            {!unfinished && (
              <button className="btn ghost sm" onClick={() => setEditing((open) => !open)}>{editing ? t("close") : t("editProfile")}</button>
            )}
          </div>
          {showWizard ? (
            <EditProfile member={member} code={inst?.code} onSaved={(next) => { updateMember(next); setEditing(false); toast(t("profileSaved")); }} />
          ) : (
            <>
              <MemberProfile member={member} />
              <IdentityRequest member={member} />
            </>
          )}
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

function IdentityRequest({ member }) {
  const { t } = useI18n();
  const { updateMember } = useAuth();
  const toast = useToast();
  const pending = member.identityRequest;
  const [form, setForm] = useState({
    name: pending?.name || member.name || "",
    email: pending?.email || member.email || "",
    mobile: pending?.mobile || member.mobile || "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const send = async () => {
    if (!form.name.trim()) return setErr(t("enterName"));
    if (!isEmail(form.email)) return setErr(t("badEmail"));
    if (!isMobile(form.mobile)) return setErr(t("badMobile"));
    if (form.name.trim() === member.name && form.email.trim().toLowerCase() === member.email && form.mobile.replace(/\D/g, "").slice(-10) === member.mobile) {
      return setErr(t("nothingToChange"));
    }
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/me/identity-request", {
        method: "POST",
        body: { name: form.name.trim(), email: form.email.trim(), mobile: form.mobile },
      });
      updateMember(data.member);
      toast(t("identitySent"));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/me/identity-request", { method: "DELETE" });
      updateMember(data.member);
      setForm({ name: data.member.name, email: data.member.email, mobile: data.member.mobile });
      toast(t("identityCancelled"));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-block" onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}>
      <h3>{t("requestIdentity")}</h3>
      <p className="sub">{t("requestIdentityHint")}</p>
      {pending && <div className="note">{t("identityPending")}</div>}
      <ErrBox msg={err} />
      <Field label={t("fullName")}>
        <input value={form.name} onChange={set("name")} />
      </Field>
      <Field label={t("emailId")}>
        <input type="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field label={t("mobileNumber")}>
        <input inputMode="tel" value={form.mobile} onChange={set("mobile")} />
      </Field>
      <div className="wizard-actions">
        {pending && <button type="button" className="btn ghost" disabled={busy} onClick={cancel}>{t("cancelRequest")}</button>}
        <button type="button" className="btn brass" disabled={busy} onClick={send}>{busy ? t("sending") : t("sendForApproval")}</button>
      </div>
    </div>
  );
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));
const isJoinedYear = (value) => {
  const year = Number(String(value).trim());
  return /^\d{4}$/.test(String(value).trim()) && year >= 1950 && year <= new Date().getFullYear() + 1;
};
const STEPS = ["stepMembership", "stepAddress", "stepFamily", "stepWork"];

function needsProfile(member) {
  return !String(member.father || "").trim() || !String(member.mother || "").trim();
}

function EditProfile({ member, code, onSaved }) {
  const { t } = useI18n();
  const { updateMember } = useAuth();
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(() => formFromMember(member));
  const [currentPw, setCurrentPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [photo, setPhoto] = useState(member.photo || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const setup = needsProfile(member);

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

  const stepError = () => {
    if (step === 1) {
      if (!form.name.trim()) return t("enterName");
      if (!isEmail(form.email)) return t("badEmail");
      if (!isMobile(form.mobile)) return t("badMobile");
      if (!isJoinedYear(form.batch)) return t("badYear");
    }
    if (step === 3 && (!form.father.trim() || !form.mother.trim())) return t("enterParents");
    return "";
  };

  const next = () => {
    const message = stepError();
    if (message) {
      setErr(message);
      return;
    }
    setErr("");
    setStep((current) => current + 1);
    window.scrollTo(0, 0);
  };

  const save = async (event) => {
    event.preventDefault();
    if (step < 4) {
      next();
      return;
    }
    const message = stepError();
    if (message) return setErr(message);
    if (!form.father.trim() || !form.mother.trim()) {
      setErr(t("enterParents"));
      setStep(3);
      return;
    }
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
    <form className="profile-form wizard" onSubmit={save} noValidate>
      <div className="wizard-steps">
        {STEPS.map((key, index) => (
          <button
            key={key}
            type="button"
            className={step >= index + 1 ? "on" : ""}
            onClick={() => index + 1 < step && (setErr(""), setStep(index + 1))}
            disabled={index + 1 > step}
          >
            <i />
            <small>{t("stepN", { n: index + 1 })}</small>
            {t(key)}
          </button>
        ))}
      </div>
      <ErrBox msg={err} />
      <p className="sub">{setup ? t("completeProfileHint") : t("editSeeHint")}</p>

      {step === 1 && (
        <>
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
          <MembershipFields form={form} setForm={setForm} batches={batches} lockIdentity />
          <IdentityRequest member={member} />
        </>
      )}
      {step === 2 && <AddressFields form={form} setForm={setForm} />}
      {step === 3 && <FamilyFields form={form} setForm={setForm} />}
      {step === 4 && (
        <>
          <WorkFields form={form} setForm={setForm} />
          <div className="profile-block">
            <h3>{t("changePassword")}</h3>
            <p className="sub">{t("passwordNext")}</p>
            <PasswordField label={t("currentPassword")} autoComplete="current-password" placeholder={t("currentPassword")} value={currentPw} onChange={(event) => setCurrentPw(event.target.value)} />
            <div className="row">
              <PasswordField label={t("newPassword")} autoComplete="new-password" value={pw} onChange={(event) => setPw(event.target.value)} />
              <PasswordField label={t("confirmNewPassword")} autoComplete="new-password" value={pw2} onChange={(event) => setPw2(event.target.value)} />
            </div>
          </div>
        </>
      )}

      <div className="wizard-actions">
        {step > 1 && (
          <button type="button" className="btn ghost" onClick={() => { setErr(""); setStep((current) => current - 1); }}>{t("back")}</button>
        )}
        {step < 4 ? (
          <button type="button" className="btn brass" onClick={next}>{t("continue")}</button>
        ) : (
          <button className="btn brass" disabled={busy}>{busy ? t("saving") : t("saveProfile")}</button>
        )}
      </div>
    </form>
  );
}

