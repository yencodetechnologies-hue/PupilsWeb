import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { AuthShell, ErrBox, Field, OtpInputs, PasswordField } from "../components";
import { useAuth, useToast } from "../state";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));

export function Login() {
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
    if (!form.id.trim() || !form.pw) return setErr("Enter your email or mobile number and password.");
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
      <p className="eyebrow">Sign in</p>
      <h1>Welcome back</h1>
      <p className="sub">Use the email or mobile number on your account.</p>
      <ErrBox msg={err} />
      <form onSubmit={submit} noValidate>
        <Field label="Email or mobile number">
          <input autoComplete="username" placeholder="you@school.edu or 9876543210" value={form.id} onChange={set("id")} />
        </Field>
        <PasswordField label="Password" autoComplete="current-password" placeholder="Your password" value={form.pw} onChange={set("pw")} />
        <div className="form-row-end">
          <Link to="/forgot" className="link">Forgot password?</Link>
        </div>
        <button className="btn block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="alt">New institution? <Link to="/register" className="link">Create an account</Link></p>
    </AuthShell>
  );
}

export function Register() {
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
    if (!form.inst.trim() || !form.name.trim()) return setErr("Enter the institution name and your name.");
    if (!isEmail(form.email)) return setErr("Enter a valid email ID.");
    if (!isMobile(form.mobile)) return setErr("Enter a valid 10-digit mobile number.");
    if (form.pw.length < 6) return setErr("Password must be at least 6 characters.");
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: { ...form, type, email: form.email.trim(), inst: form.inst.trim(), name: form.name.trim() },
      });
      setSession(data);
      toast("Account created. Add your batches next.");
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
      <p className="eyebrow">New institution</p>
      <h1>Create your institution</h1>
      <p className="sub">You'll be the admin for this school or college.</p>
      <ErrBox msg={err} />
      <div className="seg" role="group" aria-label="Institution type">
        {["School", "College", "Other"].map((item) => (
          <button key={item} type="button" className={type === item ? "on" : ""} onClick={() => setType(item)}>{item}</button>
        ))}
      </div>
      <form onSubmit={submit} noValidate>
        <Field label={type === "Other" ? "Organisation name" : `${type} name`}>
          <input placeholder={place} value={form.inst} onChange={set("inst")} />
        </Field>
        <Field label="Your name">
          <input autoComplete="name" placeholder="Full name" value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Email ID">
          <input type="email" autoComplete="email" placeholder="admin@college.edu" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Mobile number">
          <input inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} />
        </Field>
        <PasswordField label="Password" autoComplete="new-password" value={form.pw} onChange={set("pw")} />
        <button className="btn brass block" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="alt">Already have an account? <Link to="/" className="link">Sign in</Link></p>
    </AuthShell>
  );
}

export function Forgot() {
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
    if (!isEmail(email)) return setErr("Enter a valid email ID.");
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/auth/forgot", { method: "POST", body: { email: email.trim() } });
      setEmailed(data.emailed);
      setCode("");
      setStep(2);
      toast(data.emailed ? "Code sent." : "Code printed in the API terminal.");
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
    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/reset", { method: "POST", body: { email: email.trim(), password } });
      toast("Password changed. Sign in with your new password.");
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
          <h1>Reset password</h1>
          <p className="sub">Enter the email on your account. We'll send a 6-digit code.</p>
          <ErrBox msg={err} />
          <form onSubmit={send} noValidate>
            <Field label="Email ID">
              <input type="email" autoComplete="email" placeholder="you@school.edu" value={email} onChange={(event) => setEmail(event.target.value.trim())} />
            </Field>
            <button className="btn block" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
          </form>
        </>
      )}
      {step === 2 && (
        <>
          <h1>Enter the code</h1>
          <p className="sub">Sent to <b>{email}</b>. It expires in 10 minutes.</p>
          {!emailed && <div className="note">Email isn't configured on this server, so the code is printed in the API terminal.</div>}
          <ErrBox msg={err} />
          <form onSubmit={verify} noValidate>
            <OtpInputs value={code} onChange={setCode} />
            <button className="btn block" disabled={busy || code.replace(/\D/g, "").length < 6}>{busy ? "Checking…" : "Verify code"}</button>
          </form>
          <p className="alt">Didn't get it? <button type="button" className="link" onClick={send}>Resend code</button></p>
        </>
      )}
      {step === 3 && (
        <>
          <h1>Set a new password</h1>
          <p className="sub">Code verified. Choose a new password.</p>
          <ErrBox msg={err} />
          <form onSubmit={reset} noValidate>
            <PasswordField label="New password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="btn block" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
          </form>
        </>
      )}
      <p className="alt"><Link to="/" className="link">Back to sign in</Link></p>
    </AuthShell>
  );
}
