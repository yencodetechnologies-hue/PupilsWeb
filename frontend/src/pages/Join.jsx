import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, uploadPhoto } from "../api";
import { Brand, ErrBox, Loading, PasswordField, PhotoPicker } from "../components";
import { LangToggle, typeLabel, useI18n } from "../i18n";
import { AddressFields, FamilyFields, MembershipFields, WorkFields } from "../memberForm";
import { emptyMemberForm } from "../memberShape";
import { useAuth } from "../state";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));
const STEPS = ["stepMembership", "stepAddress", "stepFamily", "stepWork"];

export function Join() {
  const { t } = useI18n();
  const { code } = useParams();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [inst, setInst] = useState(undefined);

  useEffect(() => {
    api(`/api/join/${code}`)
      .then((data) => setInst(data.institution))
      .catch(() => setInst(null));
  }, [code]);

  const preview = params.get("preview") === "1" && session?.kind === "admin" && session.institution?.code === code?.toUpperCase();

  if (inst === undefined) return <Loading label={t("loadingJoin")} />;

  const bar = preview && (
    <div className="preview-bar">
      <span>{t("previewNote")}</span>
      <button className="btn sm ghost dark" onClick={() => navigate("/app")}>{t("backDashboard")}</button>
    </div>
  );

  if (!inst) {
    return (
      <>
        {bar}
        <div className="join-wrap">
          <div className="success">
            <div className="lang-row"><LangToggle tone="light" /></div>
            <h1>{t("linkInactive")}</h1>
            <p className="sub">{t("askAdmin")}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {bar}
      <JoinWizard inst={inst} preview={preview} onDone={() => navigate(preview ? "/app" : "/")} />
    </>
  );
}

function JoinWizard({ inst, preview, onDone }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(null);
  const [form, setForm] = useState(emptyMemberForm);
  const [pw, setPw] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const next = () => {
    let message = "";
    if (step === 1) {
      if (!form.batch) message = t("selectBatch");
      else if (!form.name.trim()) message = t("enterName");
      else if (!isEmail(form.email)) message = t("badEmail");
      else if (!isMobile(form.mobile)) message = t("badMobile");
      else if (pw.length < 6) message = t("shortPassword");
    } else if (step === 3) {
      if (!form.father.trim() || !form.mother.trim()) message = t("enterParents");
    }
    if (message) {
      setErr(message);
      return;
    }
    setErr("");
    setStep((current) => current + 1);
    window.scrollTo(0, 0);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (step < 4) {
      next();
      return;
    }
    if (!form.father.trim() || !form.mother.trim()) {
      setErr(t("enterParents"));
      setStep(3);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      let picture = { photo: "", photoId: "" };
      if (photoFile) picture = await uploadPhoto(photoFile);
      const data = await api(`/api/join/${inst.code}`, {
        method: "POST",
        body: {
          ...form,
          pw,
          photo: picture.photo || "",
          photoId: picture.photoId || "",
        },
      });
      setJoined(data.member);
      window.scrollTo(0, 0);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (joined) {
    return (
      <div className="join-wrap">
        <div className="success">
          <div className="badge" aria-hidden="true">✓</div>
          <div className="lang-row"><LangToggle tone="light" /></div>
          <h1>{t("youreIn", { name: joined.name.split(" ")[0] })}</h1>
          <p className="sub">{t("joinedBatch", { batch: joined.batch, name: inst.name })}</p>
          {joined.memberNo && <p className="sub">{t("memberNoAssigned", { n: joined.memberNo })}</p>}
          <button className="btn" onClick={onDone}>{preview ? t("backDashboard") : t("signIn")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-wrap">
      <header className="join-hero">
        <LangToggle />
        <Brand />
        <p className="eyebrow light">{typeLabel(t, inst.type)}</p>
        <h1>{inst.name}</h1>
        <p>{t("joinSteps")}</p>
      </header>
      <form className="join-body card wizard" onSubmit={submit} noValidate>
        <div className="wizard-steps">
          {STEPS.map((key, index) => (
            <button
              key={key}
              type="button"
              className={step >= index + 1 ? "on" : ""}
              onClick={() => index + 1 < step && setStep(index + 1)}
              disabled={index + 1 > step}
            >
              <i />
              <small>{t("stepN", { n: index + 1 })}</small>
              {t(key)}
            </button>
          ))}
        </div>
        <ErrBox msg={err} />

        {step === 1 && (
          <>
            <PhotoPicker
              name={form.name}
              file={photoFile}
              onFile={(file, message) => {
                if (message) setErr(message);
                else {
                  setErr("");
                  setPhotoFile(file);
                }
              }}
              onClear={() => setPhotoFile(null)}
            />
            {!inst.batches.length && <ErrBox msg={t("noBatchesAdmin")} />}
            <MembershipFields
              form={form}
              setForm={setForm}
              batches={inst.batches}
              password={<PasswordField label={t("password")} autoComplete="new-password" value={pw} onChange={(event) => setPw(event.target.value)} />}
            />
          </>
        )}
        {step === 2 && <AddressFields form={form} setForm={setForm} />}
        {step === 3 && <FamilyFields form={form} setForm={setForm} />}
        {step === 4 && (
          <>
            <WorkFields form={form} setForm={setForm} />
            <div className="review">
              <b>{form.name || t("yourName")}</b>
              <span>
                {form.memberNo ? `${t("memberNo")} ${form.memberNo} · ` : ""}
                {t("batchTag", { year: form.batch || "—" })}
                {" · "}
                {form.curAddress.district || t("district")}
                {form.currentJob.designation ? ` · ${form.currentJob.designation}` : ""}
              </span>
            </div>
          </>
        )}

        <div className="wizard-actions">
          {step > 1 && <button type="button" className="btn ghost" onClick={() => { setErr(""); setStep((current) => current - 1); }}>{t("back")}</button>}
          {step < 4 ? (
            <button type="button" className="btn brass" onClick={next}>{t("continue")}</button>
          ) : (
            <button className="btn brass" disabled={busy}>{busy ? t("joining") : t("joinBatch")}</button>
          )}
        </div>
        <p className="alt">{t("alreadyJoined")} <Link to="/" className="link">{t("signIn")}</Link></p>
      </form>
    </div>
  );
}
