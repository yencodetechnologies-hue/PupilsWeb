import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Avatar, ErrBox, Field, Icon } from "./components";
import { useI18n } from "./i18n";
import { useToast } from "./state";

const TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const MODES = ["On-site", "Hybrid", "Remote"];
const blank = { title: "", company: "", location: "", type: TYPES[0], mode: MODES[0], salary: "", experience: "", description: "", link: "" };

function ago(ts, lang) {
  const days = Math.floor((Date.now() - ts) / 864e5);
  if (days < 1) return lang === "ta" ? "இன்று" : "Today";
  if (days < 30) return lang === "ta" ? `${days} நாள் முன்` : `${days}d ago`;
  return new Date(ts).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short" });
}

function Applicants({ base, job }) {
  const { t, lang } = useI18n();
  const [list, setList] = useState(null);
  useEffect(() => {
    api(`${base}/${job.id}/applicants`).then((data) => setList(data.applicants)).catch(() => setList([]));
  }, [base, job.id]);
  if (!list) return <p className="sub">…</p>;
  if (!list.length) return <p className="sub">{t("noApplicants")}</p>;
  return (
    <ul className="applicants">
      {list.map((item) => (
        <li key={item.id}>
          <Avatar name={item.member.name} photo={item.member.photo} />
          <div>
            <b>{item.member.name}</b>
            <small>{[item.member.yearCompleted && t("batchTag", { year: item.member.yearCompleted }), item.member.city].filter(Boolean).join(" · ")}</small>
            <small>{item.member.mobile} · {item.member.email}</small>
            {item.note && <p>“{item.note}”</p>}
          </div>
          <span className="sub">{ago(item.createdAt, lang)}</span>
        </li>
      ))}
    </ul>
  );
}

function JobCard({ job, base, isAdmin, reload }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [panel, setPanel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = isAdmin || job.isOwner;
  const long = (job.description || "").length > 220;
  const [more, setMore] = useState(false);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      if (message) toast(message);
      reload();
    } catch (error) {
      toast(error.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`job-card ${job.closed ? "closed" : ""}`}>
      <div className="job-logo">{(job.company || "?")[0].toUpperCase()}</div>
      <div className="job-main">
        <div className="job-top">
          <div>
            <h3>{job.title}</h3>
            <p className="job-co">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
          </div>
          <span className="job-ago">{job.closed ? t("jobClosed") : ago(job.createdAt, lang)}</span>
        </div>
        <div className="job-chips">
          <span>{job.type}</span>
          <span>{job.mode}</span>
          {job.salary && <span>💰 {job.salary}</span>}
          {job.experience && <span>🎯 {job.experience}</span>}
        </div>
        {job.description && (
          <p className="job-desc">
            {more || !long ? job.description : `${job.description.slice(0, 220)}…`}
            {long && <button type="button" className="link-btn" onClick={() => setMore(!more)}>{more ? t("showLess") : t("showMore")}</button>}
          </p>
        )}
        <p className="job-by">{t("postedBy")} <b>{job.postedBy?.name}</b>{canManage && ` · ${t("applicantsCount", { n: job.applicants })}`}</p>
        <div className="job-actions">
          {!isAdmin && !job.isOwner && !job.closed && (job.applied
            ? <span className="applied-pill">✓ {t("applied")}</span>
            : <button type="button" className="btn brass sm" onClick={() => setPanel(panel === "apply" ? "" : "apply")}>{t("applyNow")}</button>)}
          {job.link && <a className="btn ghost sm" target="_blank" rel="noreferrer" href={/^https?:\/\//i.test(job.link) ? job.link : `https://${job.link}`}>{t("openLink")}</a>}
          {canManage && <button type="button" className="btn ghost sm" onClick={() => setPanel(panel === "apps" ? "" : "apps")}>{t("viewApplicants")}</button>}
          {canManage && (
            <button type="button" className="btn ghost sm" disabled={busy}
              onClick={() => act(() => api(`${base}/${job.id}`, { method: "PATCH", body: { closed: !job.closed } }))}>
              {job.closed ? t("reopenJob") : t("closeJob")}
            </button>
          )}
          {canManage && (
            <button type="button" className="btn danger sm" disabled={busy}
              onClick={() => window.confirm(t("confirmJob")) && act(() => api(`${base}/${job.id}`, { method: "DELETE" }), t("jobRemoved"))}>
              {t("remove")}
            </button>
          )}
        </div>
        {panel === "apply" && (
          <div className="job-panel">
            <Field label={t("applyNote")}>
              <textarea rows={2} maxLength={600} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <p className="sub">{t("applyShares")}</p>
            <button type="button" className="btn brass sm" disabled={busy}
              onClick={() => act(() => api(`${base}/${job.id}/apply`, { method: "POST", body: { note } }), t("appliedToast"))}>
              {t("sendApplication")}
            </button>
          </div>
        )}
        {panel === "apps" && <div className="job-panel"><Applicants base={base} job={job} /></div>}
      </div>
    </article>
  );
}

function PostJob({ base, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api(base, { method: "POST", body: form });
      toast(t("jobPosted"));
      setForm(blank);
      onDone();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card job-form" onSubmit={submit} noValidate>
      <h2>{t("postJob")}</h2>
      <ErrBox msg={err} />
      <div className="row">
        <Field label={t("jobTitle")}><input value={form.title} onChange={set("title")} maxLength={120} /></Field>
        <Field label={t("jobCompany")}><input value={form.company} onChange={set("company")} maxLength={120} /></Field>
      </div>
      <div className="row">
        <Field label={t("jobLocation")}><input value={form.location} onChange={set("location")} maxLength={120} /></Field>
        <Field label={t("jobType")}>
          <select value={form.type} onChange={set("type")}>{TYPES.map((value) => <option key={value}>{value}</option>)}</select>
        </Field>
        <Field label={t("workMode")}>
          <select value={form.mode} onChange={set("mode")}>{MODES.map((value) => <option key={value}>{value}</option>)}</select>
        </Field>
      </div>
      <div className="row">
        <Field label={t("salary")}><input value={form.salary} onChange={set("salary")} placeholder="₹4–6 LPA" maxLength={60} /></Field>
        <Field label={t("experience")}><input value={form.experience} onChange={set("experience")} placeholder="0–2 yrs" maxLength={60} /></Field>
        <Field label={t("eventLink")}><input value={form.link} onChange={set("link")} placeholder="https://" /></Field>
      </div>
      <Field label={t("eventDesc")}><textarea rows={4} value={form.description} onChange={set("description")} maxLength={3000} /></Field>
      <div className="wizard-actions"><button className="btn brass" disabled={busy}>{busy ? t("saving") : t("postJob")}</button></div>
    </form>
  );
}

export function JobBoard({ isAdmin }) {
  const { t } = useI18n();
  const base = isAdmin ? "/api/jobs" : "/api/me/jobs";
  const [jobs, setJobs] = useState(null);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState("");
  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const load = () => api(base).then((data) => setJobs(data.jobs)).catch((error) => setErr(error.message));
  useEffect(() => { load(); }, [base]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (jobs || []).filter((job) =>
      (tab === "all" || (tab === "mine" && job.isOwner) || (tab === "applied" && job.applied))
      && (!type || job.type === type) && (!mode || job.mode === mode)
      && (!needle || [job.title, job.company, job.location, job.description].join(" ").toLowerCase().includes(needle)));
  }, [jobs, query, type, mode, tab]);

  const open = (jobs || []).filter((job) => !job.closed).length;

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("jobs")}</p>
          <h1>{t("jobBoard")}</h1>
          <p>{t("jobsHint", { n: open })}</p>
        </div>
        <button type="button" className="btn brass" onClick={() => setShowForm(!showForm)}>{showForm ? t("close") : `+ ${t("postJob")}`}</button>
      </header>
      {showForm && <PostJob base={base} onDone={() => { setShowForm(false); load(); }} />}
      <ErrBox msg={err} />
      <section className="dir-card">
        <div className="dir-toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input placeholder={t("searchJobs")} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="dir-select"><span>{t("jobType")}</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">{t("all")}</option>{TYPES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="dir-select"><span>{t("workMode")}</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="">{t("all")}</option>{MODES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        {!isAdmin && (
          <div className="ev-tabs job-tabs">
            {[["all", "allJobs"], ["mine", "myJobs"], ["applied", "appliedJobs"]].map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{t(label)}</button>
            ))}
          </div>
        )}
        <div className="job-list">
          {!jobs ? null : shown.length
            ? shown.map((job) => <JobCard key={job.id} job={job} base={base} isAdmin={isAdmin} reload={load} />)
            : <div className="ev-empty"><Icon name="batches" size={30} /><p>{t("noJobs")}</p></div>}
        </div>
      </section>
    </>
  );
}
