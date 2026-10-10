import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Brand, ErrBox, Field, Loading, PasswordField } from "../components";
import { LangToggle, typeLabel, useI18n } from "../i18n";
import { useAuth } from "../state";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));

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
      <JoinAccount inst={inst} preview={preview} onDone={() => navigate("/app")} />
    </>
  );
}

function JoinAccount({ inst, preview, onDone }) {
  const { t } = useI18n();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", batch: "", mobile: "", pw: "", pw2: "" });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const years = [...(inst.batches || [])].sort((a, b) => b - a);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setErr(t("enterName"));
    if (!isEmail(form.email)) return setErr(t("badEmail"));
    if (!form.batch) return setErr(t("selectBatch"));
    if (!isMobile(form.mobile)) return setErr(t("badMobile"));
    if (form.pw.length < 6) return setErr(t("shortPassword"));
    if (form.pw !== form.pw2) return setErr(t("passwordMismatch"));
    setBusy(true);
    setErr("");
    try {
      const data = await api(`/api/join/${inst.code}`, {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          batch: form.batch,
          mobile: form.mobile,
          pw: form.pw,
        },
      });
      if (preview) {
        setJoined(data.member);
        window.scrollTo(0, 0);
        return;
      }
      const session = await api("/api/auth/login", {
        method: "POST",
        body: { id: form.email.trim(), pw: form.pw },
      });
      setSession(session);
      navigate("/home");
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
          <button className="btn" onClick={onDone}>{t("backDashboard")}</button>
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
      <form className="join-body card" onSubmit={submit} noValidate>
        <ErrBox msg={err} />
        {!inst.batches.length && <ErrBox msg={t("noBatchesAdmin")} />}
        <Field label={t("fullName")}>
          <input autoComplete="name" placeholder={t("fullName")} value={form.name} onChange={set("name")} />
        </Field>
        <Field label={t("emailId")}>
          <input type="email" autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label={t("batch")}>
          <select value={form.batch} onChange={set("batch")}>
            <option value="">{t("selectYourBatch")}</option>
            {years.map((year) => <option key={year} value={year}>{t("batchTag", { year })}</option>)}
          </select>
        </Field>
        <Field label={t("mobileNumber")}>
          <input inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} />
        </Field>
        <PasswordField label={t("password")} autoComplete="new-password" value={form.pw} onChange={set("pw")} />
        <PasswordField label={t("confirmPassword")} autoComplete="new-password" value={form.pw2} onChange={set("pw2")} />
        <button className="btn brass block" disabled={busy || !inst.batches.length}>{busy ? t("creating") : t("createAccount")}</button>
        <p className="alt">{t("alreadyJoined")} <Link to="/" className="link">{t("signIn")}</Link></p>
      </form>
    </div>
  );
}
