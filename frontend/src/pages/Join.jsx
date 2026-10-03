import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, uploadPhoto } from "../api";
import { Brand, ErrBox, Field, Loading, PasswordField, PhotoPicker } from "../components";
import { LangToggle, typeLabel, useI18n } from "../i18n";
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
      if (!form.batch) message = t("selectBatch");
      else if (!form.name.trim()) message = t("enterName");
      else if (!isEmail(form.email)) message = t("badEmail");
      else if (!isMobile(form.mobile)) message = t("badMobile");
      else if (form.pw.length < 6) message = t("shortPassword");
    } else if (step === 2) {
      if (!form.father.trim() || !form.mother.trim()) message = t("enterParents");
      else if (!form.city.trim()) message = t("enterCity");
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
      setErr(t("enterQual"));
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
          schools: schools || [],
          colleges: colleges || [],
          businesses: businesses || [],
          links: links || [],
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
          {["stepAccount", "stepAbout", "stepWork"].map((key, index) => (
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
          <section>
            <h2>{t("yourAccount")}</h2>
            <p className="sub">{t("pickYear")}</p>
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
            <Field label={t("batch")}>
              <select value={form.batch} onChange={set("batch")}>
                <option value="">{t("selectYourBatch")}</option>
                {[...inst.batches].sort((a, b) => b - a).map((year) => <option key={year} value={year}>{t("batchTag", { year })}</option>)}
              </select>
            </Field>
            <Field label={t("fullName")}>
              <input autoComplete="name" value={form.name} onChange={set("name")} />
            </Field>
            <div className="row">
              <Field label={t("emailId")}><input type="email" autoComplete="email" value={form.email} onChange={set("email")} /></Field>
              <Field label={t("mobileNumber")}><input inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.mobile} onChange={set("mobile")} /></Field>
            </div>
            <PasswordField label={t("password")} autoComplete="new-password" value={form.pw} onChange={set("pw")} />
          </section>
        )}

        {step === 2 && (
          <section>
            <h2>{t("aboutYou")}</h2>
            <p className="sub">{t("aboutHint")}</p>
            <div className="row">
              <Field label={t("fathersName")}><input value={form.father} onChange={set("father")} /></Field>
              <Field label={t("mothersName")}><input value={form.mother} onChange={set("mother")} /></Field>
            </div>
            <Field label={t("currentCity")}><input placeholder="Chennai" value={form.city} onChange={set("city")} /></Field>
            {!more ? (
              <button type="button" className="add-block" onClick={() => setMore(true)}>
                <strong>{t("addMore")}</strong>
                <span>{t("addMoreHint")}</span>
              </button>
            ) : (
              <div className="more">
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
                <Field label={t("currentAddress")}><textarea value={form.curAddr} onChange={set("curAddr")} /></Field>
                <div className="inline-action">
                  <button type="button" className="btn ghost sm" onClick={() => setForm((current) => ({ ...current, nativeAddr: current.curAddr }))}>{t("nativeSame")}</button>
                </div>
                <Field label={t("nativeAddress")}><textarea value={form.nativeAddr} onChange={set("nativeAddr")} /></Field>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section>
            <h2>{t("workStudy")}</h2>
            <p className="sub">{t("workHint")}</p>
            <div className="row">
              <Field label={t("highestQual")}><input placeholder="B.E. Mechanical, MBA" value={form.qualification} onChange={set("qualification")} /></Field>
              <Field label={t("currentOccupation")}><input placeholder="Software engineer" value={form.occupation} onChange={set("occupation")} /></Field>
            </div>
            <Repeater title={t("schools")} hint={t("schoolsHint")} addLabel={t("addSchool")} items={schools} setItems={setSchools} blank={BLANKS.schools} fields={[["name", t("schoolName")], ["board", t("board")], ["from", t("fromYear")], ["to", t("toYear")]]} />
            <Repeater title={t("colleges")} hint={t("collegesHint")} addLabel={t("addCollege")} items={colleges} setItems={setColleges} blank={BLANKS.colleges} fields={[["name", t("collegeName")], ["degree", t("degree")], ["from", t("fromYear")], ["to", t("toYear")]]} />
            <Repeater title={t("business")} hint={t("businessHint")} addLabel={t("addBusiness")} items={businesses} setItems={setBusinesses} blank={BLANKS.businesses} fields={[["name", t("businessName")], ["role", t("yourRole")], ["city", t("city")], ["web", t("website")]]} />
            <Repeater title={t("links")} hint={t("linksHint")} addLabel={t("addALink")} items={links} setItems={setLinks} blank={BLANKS.links} fields={[["label", t("label")], ["url", t("url")]]} />
            <div className="review">
              <b>{form.name || t("yourName")}</b>
              <span>{t("batchTag", { year: form.batch || "—" })} · {form.city || t("city")} · {form.qualification || t("qualification")}</span>
            </div>
          </section>
        )}

        <div className="wizard-actions">
          {step > 1 && <button type="button" className="btn ghost" onClick={() => { setErr(""); setStep((current) => current - 1); }}>{t("back")}</button>}
          {step < 3 ? (
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

function Repeater({ title, hint, addLabel, items, setItems, blank, fields }) {
  const { t } = useI18n();
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
        <button type="button" className="btn ghost sm" onClick={() => setItems([...items, { ...blank }])}>{t("addAnother")}</button>
      </div>
      {items.map((item, index) => (
        <div className="rep" key={index}>
          <button type="button" className="x" aria-label={t("removeItem", { title })} onClick={() => {
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
