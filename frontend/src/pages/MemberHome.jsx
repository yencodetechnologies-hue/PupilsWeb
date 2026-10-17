import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, uploadPhoto } from "../api";
import { BI, VISIBILITY_GROUPS } from "../biLabels";
import { Brand, ErrBox, Field } from "../components";
import { LangToggle, useI18n } from "../i18n";
import { MemberEvents } from "../events";
import { JobBoard } from "../jobs";
import { Network } from "../network";
import { ProfileRecord, RegistrationSheet } from "../memberForm";
import { formFromMember, formIssues, spouseRelevant, visibilityFrom } from "../memberShape";
import { useAuth, useToast } from "../state";

export function MemberHome() {
  const { t } = useI18n();
  const { session, setSession, updateMember } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const member = session.member;
  const inst = session.institution;
  const unfinished = needsProfile(member);
  const [view, setView] = useState("profile");
  const [editing, setEditing] = useState(false);
  const showForm = view === "profile" && (unfinished || editing);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    navigate("/");
  };

  const printSheet = () => {
    const previous = document.title;
    document.title = `${member.name || "Alumni"} registration`;
    window.print();
    document.title = previous;
  };

  return (
    <div className="join-wrap member-home">
      <header className="join-hero no-print">
        <LangToggle />
        <Brand />
        <p className="eyebrow light">{member.name}</p>
        <h1>{inst?.name || t("yourInstitution")}</h1>
        <p>{t("batchTag", { year: member.yearCompleted || member.batch })}</p>
      </header>
      <div className="join-body stack">
        <nav className="member-nav no-print" aria-label={t("profile")}>
          <button type="button" className={view === "profile" ? "on" : ""} onClick={() => setView("profile")}>{t("profile")}</button>
          <button type="button" className={view === "events" ? "on" : ""} onClick={() => setView("events")}>{t("events")}</button>
          <button type="button" className={view === "friends" ? "on" : ""} onClick={() => setView("friends")}>{t("network")}</button>
          <button type="button" className={view === "jobs" ? "on" : ""} onClick={() => setView("jobs")}>{t("jobs")}</button>
          <button type="button" className={view === "settings" ? "on" : ""} onClick={() => setView("settings")}>{t("settings")}</button>
        </nav>

        {view === "profile" && (
          <section className="card profile-card">
            <div className="sec-h no-print">
              <h2>{showForm && unfinished ? t("completeProfile") : t("yourProfile")}</h2>
              <div className="sheet-actions">
                {!showForm && (
                  <>
                    <button type="button" className="btn ghost sm" onClick={printSheet}>{t("printForm")}</button>
                    <button type="button" className="btn ghost sm" onClick={printSheet}>{t("downloadPdf")}</button>
                    <button type="button" className="btn ghost sm" onClick={() => setEditing(true)}>{t("editProfile")}</button>
                  </>
                )}
                {!unfinished && showForm && (
                  <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>{t("close")}</button>
                )}
              </div>
            </div>
            {showForm ? (
              <EditProfile
                member={member}
                code={inst?.code}
                institutionName={inst?.name}
                onSaved={(next) => { updateMember(next); setEditing(false); toast(t("profileSaved")); }}
                onPrint={printSheet}
              />
            ) : (
              <ProfileRecord member={member} institutionName={inst?.name} />
            )}
          </section>
        )}

        {view === "events" && <MemberEvents />}
        {view === "friends" && <Network />}
        {view === "jobs" && <JobBoard isAdmin={false} />}
        {view === "settings" && <VisibilitySettings member={member} />}
        <button className="btn ghost no-print" onClick={logout}>{t("signOut")}</button>
      </div>
    </div>
  );
}

function VisibilitySettings({ member }) {
  const { t } = useI18n();
  const { updateMember } = useAuth();
  const toast = useToast();
  const [visibility, setVisibility] = useState(() => visibilityFrom(member));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVisibility(visibilityFrom(member));
  }, [member]);

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/me/visibility", { method: "PATCH", body: { visibility } });
      updateMember(data.member);
      toast(t("visibilitySaved"));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card no-print">
      <h2>{t("visibilityTitle")}</h2>
      <p className="sub">{t("visibilityHint")}</p>
      <ErrBox msg={err} />
      {VISIBILITY_GROUPS.map((group) => (
        <div className="sheet-sec" key={group.title[0]}>
          <h3>{group.title[0]}</h3>
          <p className="ta" lang="ta">{group.title[1]}</p>
          {group.fields.map(([key, label]) => {
            const shown = member.gender === "Female" && key === "spouseName" ? BI.husbandName
              : member.gender === "Female" && key === "spouseOccupation" ? BI.husbandOccupation
              : member.gender === "Female" && key === "spouseCompany" ? BI.husbandCompany
              : label;
            return (
            <div className="vis-row" key={key}>
              <span className="bi-label">
                <b>{shown[0]}</b>
                <small lang="ta">{shown[1]}</small>
              </span>
              <select
                value={visibility[key]}
                aria-label={shown[0]}
                onChange={(event) => setVisibility((current) => ({ ...current, [key]: event.target.value }))}
              >
                <option value="everyone">{t("visibilityEveryone")}</option>
                <option value="batch">{t("visibilityBatch")}</option>
                <option value="off">{t("visibilityOff")}</option>
              </select>
            </div>
            );
          })}
        </div>
      ))}
      <p className="sub">{BI.photo[0]} / {BI.photo[1]} · {BI.name[0]} / {BI.name[1]} — {t("alwaysVisible")}</p>
      <button type="button" className="btn brass" disabled={busy} onClick={save}>{busy ? t("saving") : t("saveProfile")}</button>
    </section>
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
    <div className="profile-block no-print" onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}>
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

function needsProfile(member) {
  return !String(member.father || "").trim() || !String(member.mother || "").trim();
}

function EditProfile({ member, code, institutionName, onSaved, onPrint }) {
  const { t } = useI18n();
  const { updateMember } = useAuth();
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(() => formFromMember(member));
  const [photo, setPhoto] = useState(member.photo || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [issues, setIssues] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

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

  const reset = () => {
    setForm(formFromMember(member));
    setIssues({});
    setErr("");
  };

  const save = async (event) => {
    event.preventDefault();
    const found = formIssues(form);
    const labels = Object.fromEntries(Object.entries(found).map(([key, code]) => [key, t(code)]));
    if (!form.name.trim()) labels.name = t("enterName");
    if (!isJoinedYear(form.batch)) labels.batch = t("badYear");
    if (!form.father.trim() || !form.mother.trim()) {
      if (!form.father.trim()) labels.father = t("enterParents");
      if (!form.mother.trim()) labels.mother = t("enterParents");
    }
    setIssues(labels);
    if (Object.keys(labels).length) {
      setErr(Object.values(labels)[0]);
      return;
    }
    const body = { ...form };
    if (!spouseRelevant(body.maritalStatus)) {
      body.spouseName = "";
      body.spouseOccupation = "";
      body.spouseCompany = "";
    }
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/me", { method: "PATCH", body });
      onSaved({ ...data.member, photo: data.member.photo || photo });
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={save} noValidate>
      <p className="sub no-print">{needsProfile(member) ? t("completeProfileHint") : t("editSeeHint")}</p>
      <ErrBox msg={err} />
      <RegistrationSheet
        form={form}
        setForm={setForm}
        batches={batches}
        lockIdentity
        issues={issues}
        photo={photo}
        photoFile={photoFile}
        institutionName={institutionName}
        onPhoto={(file, message) => {
          if (message) {
            setErr(message);
            return;
          }
          setErr("");
          setPhotoFile(file);
          storePhoto(file);
        }}
        onClearPhoto={clearPhoto}
        identity={<IdentityRequest member={member} />}
      />
      <div className="wizard-actions no-print">
        <button type="button" className="btn ghost" onClick={reset}>{t("resetForm")}</button>
        <button type="button" className="btn ghost" onClick={onPrint}>{t("printForm")}</button>
        <button type="button" className="btn ghost" onClick={onPrint}>{t("downloadPdf")}</button>
        <button className="btn brass" disabled={busy}>{busy ? t("saving") : t("saveProfile")}</button>
      </div>
    </form>
  );
}
