import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, uploadPhoto } from "../api";
import { Avatar, Brand, ErrBox, MemberProfile, PasswordField, PhotoPicker } from "../components";
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

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));

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

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setErr(t("enterName"));
    if (!isEmail(form.email)) return setErr(t("badEmail"));
    if (!isMobile(form.mobile)) return setErr(t("badMobile"));
    if (!form.batch) return setErr(t("selectBatch"));
    if (!form.father.trim() || !form.mother.trim()) return setErr(t("enterParents"));
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
      <MembershipFields form={form} setForm={setForm} batches={batches} />
      <AddressFields form={form} setForm={setForm} />
      <FamilyFields form={form} setForm={setForm} />
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
      <div className="profile-save">
        <button className="btn brass" disabled={busy}>{busy ? t("saving") : t("saveProfile")}</button>
      </div>
    </form>
  );
}

