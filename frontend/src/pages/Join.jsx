import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, uploadPhoto } from "../api";
import { Brand, ErrBox, Field, Loading, PasswordField, PhotoPicker } from "../components";
import { useAuth } from "../state";

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));
const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const BLANKS = {
  schools: { name: "", board: "", from: "", to: "" },
  colleges: { name: "", degree: "", from: "", to: "" },
  businesses: { name: "", role: "", city: "", web: "" },
  links: { label: "", url: "" },
};

export function Join() {
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

  if (inst === undefined) return <Loading label="Loading the join form…" />;

  const bar = preview && (
    <div className="preview-bar">
      <span>This is the form your alumni will see.</span>
      <button className="btn sm ghost dark" onClick={() => navigate("/app")}>Back to dashboard</button>
    </div>
  );

  if (!inst) {
    return (
      <>
        {bar}
        <div className="join-wrap">
          <div className="success">
            <h1>This link isn't active</h1>
            <p className="sub">Ask your school or college admin for a fresh join link.</p>
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
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [joined, setJoined] = useState(null);
  const [form, setForm] = useState({
    batch: "", name: "", email: "", mobile: "", pw: "",
    father: "", mother: "", city: "", qualification: "", occupation: "",
    dob: "", gender: "", blood: "", curAddr: "", nativeAddr: "",
  });
  const [schools, setSchools] = useState(null);
  const [colleges, setColleges] = useState(null);
  const [businesses, setBusinesses] = useState(null);
  const [links, setLinks] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const next = () => {
    let message = "";
    if (step === 1) {
      if (!form.batch) message = "Select your batch.";
      else if (!form.name.trim()) message = "Enter your full name.";
      else if (!isEmail(form.email)) message = "Enter a valid email ID.";
      else if (!isMobile(form.mobile)) message = "Enter a valid 10-digit mobile number.";
      else if (form.pw.length < 6) message = "Password must be at least 6 characters.";
    } else if (step === 2) {
      if (!form.father.trim() || !form.mother.trim()) message = "Enter your father's and mother's names.";
      else if (!form.city.trim()) message = "Enter your current city.";
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
    if (step < 3) {
      next();
      return;
    }
    if (!form.qualification.trim()) {
      setErr("Enter your highest qualification.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      let picture = {};
      if (photoFile) {
        picture = await uploadPhoto(photoFile);
      }
      const data = await api(`/api/join/${inst.code}`, {
        method: "POST",
        body: {
          ...form,
          schools: schools || [],
          colleges: colleges || [],
          businesses: businesses || [],
          links: links || [],
          ...picture,
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
          <h1>You're in, {joined.name.split(" ")[0]}</h1>
          <p className="sub">You joined Batch {joined.batch} of {inst.name}. Sign in anytime with your email or mobile number.</p>
          <button className="btn" onClick={onDone}>{preview ? "Back to dashboard" : "Sign in"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-wrap">
      <header className="join-hero">
        <Brand />
        <p className="eyebrow light">{inst.type}</p>
        <h1>{inst.name}</h1>
        <p>Join your batch in three short steps.</p>
      </header>
      <form className="join-body card wizard" onSubmit={submit} noValidate>
        <div className="wizard-steps">
          {["Account", "About you", "Work"].map((label, index) => (
            <button
              key={label}
              type="button"
              className={step >= index + 1 ? "on" : ""}
              onClick={() => index + 1 < step && setStep(index + 1)}
              disabled={index + 1 > step}
            >
              <i />
              <small>Step {index + 1}</small>
              {label}
            </button>
          ))}
        </div>
        <ErrBox msg={err} />

        {step === 1 && (
          <section>
            <h2>Your account</h2>
            <p className="sub">Pick the year you passed out. You'll sign in with these details.</p>
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
            {!inst.batches.length && <ErrBox msg="This institution has no batches yet. Ask the admin to add one." />}
            <Field label="Batch">
              <select value={form.batch} onChange={set("batch")}>
                <option value="">Select your batch</option>
                {[...inst.batches].sort((a, b) => b - a).map((year) => <option key={year} value={year}>Batch {year}</option>)}
              </select>
            </Field>
            <Field label="Full name">
              <input autoComplete="name" value={form.name} onChange={set("name")} />
            </Field>
            <div className="row">
              <Field label="Email ID"><input type="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Mobile number"><input inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} /></Field>
            </div>
            <PasswordField label="Password" autoComplete="new-password" value={form.pw} onChange={set("pw")} />
          </section>
        )}

        {step === 2 && (
          <section>
            <h2>About you</h2>
            <p className="sub">Just the names and city. Everything else is optional.</p>
            <div className="row">
              <Field label="Father's name"><input value={form.father} onChange={set("father")} /></Field>
              <Field label="Mother's name"><input value={form.mother} onChange={set("mother")} /></Field>
            </div>
            <Field label="Current city"><input placeholder="Chennai" value={form.city} onChange={set("city")} /></Field>
            {!more ? (
              <button type="button" className="add-block" onClick={() => setMore(true)}>
                <strong>Add more details</strong>
                <span>Date of birth, blood group, and addresses</span>
              </button>
            ) : (
              <div className="more">
                <div className="row3">
                  <Field label="Date of birth"><input type="date" value={form.dob} onChange={set("dob")} /></Field>
                  <Field label="Gender">
                    <select value={form.gender} onChange={set("gender")}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Prefer not to say</option>
                    </select>
                  </Field>
                  <Field label="Blood group">
                    <select value={form.blood} onChange={set("blood")}>
                      <option value="">Select</option>
                      {BLOOD.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Current address"><textarea value={form.curAddr} onChange={set("curAddr")} /></Field>
                <div className="inline-action">
                  <button type="button" className="btn ghost sm" onClick={() => setForm((current) => ({ ...current, nativeAddr: current.curAddr }))}>Native same as current</button>
                </div>
                <Field label="Native address"><textarea value={form.nativeAddr} onChange={set("nativeAddr")} /></Field>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section>
            <h2>Work and study</h2>
            <p className="sub">Qualification is enough. Add schools or a business only if you want batchmates to see them.</p>
            <div className="row">
              <Field label="Highest qualification"><input placeholder="B.E. Mechanical, MBA" value={form.qualification} onChange={set("qualification")} /></Field>
              <Field label="Current occupation"><input placeholder="Software engineer" value={form.occupation} onChange={set("occupation")} /></Field>
            </div>
            <Repeater title="Schools" hint="Boards and years you studied." addLabel="Add a school" items={schools} setItems={setSchools} blank={BLANKS.schools} fields={[["name", "School name"], ["board", "Board"], ["from", "From year"], ["to", "To year"]]} />
            <Repeater title="Colleges" hint="UG, PG, or diploma." addLabel="Add a college" items={colleges} setItems={setColleges} blank={BLANKS.colleges} fields={[["name", "College name"], ["degree", "Degree"], ["from", "From year"], ["to", "To year"]]} />
            <Repeater title="Business" hint="So batchmates can find what you run." addLabel="Add a business" items={businesses} setItems={setBusinesses} blank={BLANKS.businesses} fields={[["name", "Business name"], ["role", "Your role"], ["city", "City"], ["web", "Website"]]} />
            <Repeater title="Links" hint="LinkedIn, Instagram, or a portfolio." addLabel="Add a link" items={links} setItems={setLinks} blank={BLANKS.links} fields={[["label", "Label"], ["url", "URL"]]} />
            <div className="review">
              <b>{form.name || "Your name"}</b>
              <span>Batch {form.batch || "—"} · {form.city || "City"} · {form.qualification || "Qualification"}</span>
            </div>
          </section>
        )}

        <div className="wizard-actions">
          {step > 1 && <button type="button" className="btn ghost" onClick={() => { setErr(""); setStep((current) => current - 1); }}>Back</button>}
          {step < 3 ? (
            <button type="button" className="btn brass" onClick={next}>Continue</button>
          ) : (
            <button className="btn brass" disabled={busy}>{busy ? "Joining…" : "Join batch"}</button>
          )}
        </div>
        <p className="alt">Already joined? <Link to="/" className="link">Sign in</Link></p>
      </form>
    </div>
  );
}

function Repeater({ title, hint, addLabel, items, setItems, blank, fields }) {
  if (!items) {
    return (
      <button type="button" className="add-block" onClick={() => setItems([{ ...blank }])}>
        <strong>{addLabel}</strong>
        <span>{hint}</span>
      </button>
    );
  }
  const update = (index, key, value) => setItems(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  return (
    <div className="repeater">
      <div className="sec-h">
        <div><h3>{title}</h3><p>{hint}</p></div>
        <button type="button" className="btn ghost sm" onClick={() => setItems([...items, { ...blank }])}>Add another</button>
      </div>
      {items.map((item, index) => (
        <div className="rep" key={index}>
          <button type="button" className="x" aria-label={`Remove ${title}`} onClick={() => {
            const next = items.filter((_, i) => i !== index);
            setItems(next.length ? next : null);
          }}>×</button>
          <div className="row">
            {fields.map(([key, label]) => (
              <Field key={key} label={label}>
                <input value={item[key]} onChange={(event) => update(index, key, event.target.value)} />
              </Field>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
