import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { AuthShell, ErrBox, Field, OtpInputs, PasswordField } from "../components";
import { useI18n } from "../i18n";
import { useAuth, useToast } from "../state";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));

export function Login() {
  const { t } = useI18n();
  const { session, ready, setSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ id: "", pw: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  if (ready && session?.kind === "admin") return <Navigate to="/app" replace />;
  if (ready && session?.kind === "member") return <Navigate to="/home" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.id.trim() || !form.pw) return setErr(t("loginMissing"));
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/auth/login", { method: "POST", body: { id: form.id.trim(), pw: form.pw } });
      setSession(data);
      navigate(data.kind === "admin" ? "/app" : "/home");
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <p className="eyebrow">{t("signIn")}</p>
      <h1>{t("welcomeBack")}</h1>
      <p className="sub">{t("loginHint")}</p>
      <ErrBox msg={err} />
      <form onSubmit={submit} noValidate>
        <Field label={t("emailOrMobile")}>
          <input autoComplete="username" placeholder={t("emailOrMobilePh")} value={form.id} onChange={set("id")} />
        </Field>
        <PasswordField label={t("password")} autoComplete="current-password" placeholder={t("yourPassword")} value={form.pw} onChange={set("pw")} />
        <div className="form-row-end">
          <Link to="/forgot" className="link">{t("forgotPassword")}</Link>
        </div>
        <button className="btn block" disabled={busy}>{busy ? t("signingIn") : t("signIn")}</button>
      </form>
      <p className="alt">{t("newInstitutionQ")} <Link to="/register" className="link">{t("createAnAccount")}</Link></p>
    </AuthShell>
  );
}

const TYPES = [
  ["School", "typeSchool"],
  ["College", "typeCollege"],
  ["Other", "typeOther"],
];

export function Register() {
  const { t } = useI18n();
  const { session, ready, setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [type, setType] = useState("College");
  const [form, setForm] = useState({ inst: "", name: "", email: "", mobile: "", pw: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  if (ready && session) return <Navigate to={session.kind === "admin" ? "/app" : "/home"} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.inst.trim() || !form.name.trim()) return setErr(t("needInstName"));
    if (!isEmail(form.email)) return setErr(t("badEmail"));
    if (!isMobile(form.mobile)) return setErr(t("badMobile"));
    if (form.pw.length < 6) return setErr(t("shortPassword"));
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: { ...form, type, email: form.email.trim(), inst: form.inst.trim(), name: form.name.trim() },
      });
      setSession(data);
      toast(t("accountCreated"));
      navigate("/app");
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const place = type === "School" ? "St. Joseph's Matric Hr. Sec. School" : "Anna University, CEG";

  return (
    <AuthShell>
      <p className="eyebrow">{t("newInstitution")}</p>
      <h1>{t("createInstitution")}</h1>
      <p className="sub">{t("adminHint")}</p>
      <ErrBox msg={err} />
      <div className="seg" role="group" aria-label={t("institutionType")}>
        {TYPES.map(([value, key]) => (
          <button key={value} type="button" className={type === value ? "on" : ""} onClick={() => setType(value)}>{t(key)}</button>
        ))}
      </div>
      <form onSubmit={submit} noValidate>
        <Field label={type === "Other" ? t("orgName") : t("namedType", { type: t(TYPES.find(([value]) => value === type)?.[1] || "typeCollege") })}>
          <input placeholder={place} value={form.inst} onChange={set("inst")} />
        </Field>
        <Field label={t("yourName")}>
          <input autoComplete="name" placeholder={t("fullName")} value={form.name} onChange={set("name")} />
        </Field>
        <Field label={t("emailId")}>
          <input type="email" autoComplete="email" placeholder="admin@college.edu" value={form.email} onChange={set("email")} />
        </Field>
        <Field label={t("mobileNumber")}>
          <input inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} />
        </Field>
        <PasswordField label={t("password")} autoComplete="new-password" value={form.pw} onChange={set("pw")} />
        <button className="btn brass block" disabled={busy}>{busy ? t("creating") : t("createAccount")}</button>
      </form>
      <p className="alt">{t("haveAccount")} <Link to="/" className="link">{t("signIn")}</Link></p>
    </AuthShell>
  );
}

export function Forgot() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [emailed, setEmailed] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (event) => {
    event?.preventDefault();
    if (!isEmail(email)) return setErr(t("badEmail"));
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/auth/forgot", { method: "POST", body: { email: email.trim() } });
      setEmailed(data.emailed);
      setCode("");
      setStep(2);
      toast(data.emailed ? t("codeSent") : t("codePrinted"));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/verify-otp", { method: "POST", body: { email: email.trim(), code: code.replace(/\D/g, "") } });
      setStep(3);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (event) => {
    event.preventDefault();
    if (password.length < 6) return setErr(t("shortPassword"));
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/reset", { method: "POST", body: { email: email.trim(), password } });
      toast(t("passwordChanged"));
      navigate("/");
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="steps" aria-hidden="true">
        {[1, 2, 3].map((item) => <i key={item} className={step >= item ? "on" : ""} />)}
      </div>
      {step === 1 && (
        <>
          <h1>{t("resetPassword")}</h1>
          <p className="sub">{t("resetHint")}</p>
          <ErrBox msg={err} />
          <form onSubmit={send} noValidate>
            <Field label={t("emailId")}>
              <input type="email" autoComplete="email" placeholder="you@school.edu" value={email} onChange={(event) => setEmail(event.target.value.trim())} />
            </Field>
            <button className="btn block" disabled={busy}>{busy ? t("sending") : t("sendCode")}</button>
          </form>
        </>
      )}
      {step === 2 && (
        <>
          <h1>{t("enterCode")}</h1>
          <p className="sub">{t("codeSentTo", { email })}</p>
          {!emailed && <div className="note">{t("emailNotConfigured")}</div>}
          <ErrBox msg={err} />
          <form onSubmit={verify} noValidate>
            <OtpInputs value={code} onChange={setCode} />
            <button className="btn block" disabled={busy || code.replace(/\D/g, "").length < 6}>{busy ? t("checking") : t("verifyCode")}</button>
          </form>
          <p className="alt">{t("didntGet")} <button type="button" className="link" onClick={send}>{t("resendCode")}</button></p>
        </>
      )}
      {step === 3 && (
        <>
          <h1>{t("setNewPassword")}</h1>
          <p className="sub">{t("codeVerified")}</p>
          <ErrBox msg={err} />
          <form onSubmit={reset} noValidate>
            <PasswordField label={t("newPassword")} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="btn block" disabled={busy}>{busy ? t("saving") : t("changePassword")}</button>
          </form>
        </>
      )}
      <p className="alt"><Link to="/" className="link">{t("backToSignIn")}</Link></p>
    </AuthShell>
  );
}
