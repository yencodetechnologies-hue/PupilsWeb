import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadCsv } from "../api";
import { joinUrl } from "../site";
import { Avatar, Brand, Drawer, ErrBox, Field, Icon, MemberProfile, PasswordField } from "../components";
import { AdminEvents } from "../events";
import { JobBoard } from "../jobs";
import { LangToggle, typeLabel, useI18n } from "../i18n";
import { useAuth, useToast } from "../state";

const TABS = [
  ["overview", "overview"],
  ["batches", "batches"],
  ["link", "joinLink"],
  ["events", "events"],
  ["jobs", "jobs"],
  ["members", "alumni"],
  ["profile", "profile"],
];

export function Dashboard() {
  const { t } = useI18n();
  const { session, updateInstitution } = useAuth();
  const toast = useToast();
  const inst = session.institution;
  const [tab, setTab] = useState(inst.batches.length ? "overview" : "batches");
  const [focusYear, setFocusYear] = useState(null);
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  const loadMembers = () => {
    api("/api/members")
      .then((data) => setMembers(data.members))
      .catch((error) => setLoadErr(error.message));
  };

  useEffect(() => { loadMembers(); }, []);

  const applyInst = (institution) => updateInstitution(institution);

  const go = (key) => { setFocusYear(null); setTab(key); window.scrollTo(0, 0); };
  const openBatch = (year) => { setFocusYear(year); setTab("members"); loadMembers(); };
  const countFor = (key) => (key === "members" ? members?.length ?? 0 : key === "batches" ? inst.batches.length : null);

  const nav = TABS.map(([key, label]) => (
    <button key={key} className={`nav ${tab === key ? "on" : ""}`} onClick={() => go(key)}>
      <span className="nav-l"><Icon name={key} />{t(label)}</span>
      {countFor(key) !== null && <span className="count">{countFor(key)}</span>}
    </button>
  ));

  return (
    <div className="app">
      <aside className="side">
        <div className="side-top">
          <Brand />
          <LangToggle />
        </div>
        <div className="inst">
          <b>{inst.name}</b>
          <small>{typeLabel(t, inst.type)} · {inst.admin.name}</small>
        </div>
        {nav}
        <div className="spacer" />
        <SignOut />
      </aside>
      <div className="shell">
        <header className="mobile-bar">
          <div className="brand-mark">P</div>
          <div className="mb-title">
            <b>{inst.name}</b>
            <small>{typeLabel(t, inst.type)} · {inst.admin.name}</small>
          </div>
          <LangToggle />
          <SignOut compact />
        </header>
        <main className="main">
          {loadErr && <ErrBox msg={loadErr} />}
          {tab === "overview" && <Overview inst={inst} members={members} setTab={go} />}
          {tab === "batches" && <Batches inst={inst} members={members || []} onChange={applyInst} onOpen={openBatch} />}
          {tab === "link" && <JoinLink inst={inst} onChange={applyInst} />}
          {tab === "members" && (
            <Members
              inst={inst}
              members={members}
              setTab={go}
              focusYear={focusYear}
              reload={loadMembers}
              onRemove={(id) => setMembers((list) => list.filter((item) => item.id !== id))}
              onUpdate={(member) => setMembers((list) => list.map((item) => (item.id === member.id ? member : item)))}
            />
          )}
          {tab === "events" && <AdminEvents />}
          {tab === "jobs" && <JobBoard isAdmin />}
          {tab === "profile" && <AccountProfile inst={inst} onChange={applyInst} />}
        </main>
        <nav className="tabbar" aria-label={t("sections")}>
          {TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? "on" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => go(key)}>
              <span className="tb-icon">
                <Icon name={key} size={22} />
                {key === "members" && !!members?.length && <i className="dot">{members.length}</i>}
              </span>
              {t(label)}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isMobile = (value) => /^[6-9]\d{9}$/.test(String(value).replace(/\D/g, "").slice(-10));

function AccountProfile({ inst, onChange }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(inst.admin.name || "");
  const [email, setEmail] = useState(inst.admin.email || "");
  const [mobile, setMobile] = useState(inst.admin.mobile || "");
  const [instName, setInstName] = useState(inst.name || "");
  const [type, setType] = useState(inst.type || "College");
  const [currentPw, setCurrentPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    if (!name.trim()) return setErr(t("enterYourName"));
    if (!instName.trim()) return setErr(t("enterInstName"));
    if (!isEmail(email)) return setErr(t("badEmail"));
    if (!isMobile(mobile)) return setErr(t("badMobile"));
    const changingPassword = currentPw || pw || pw2;
    if (changingPassword) {
      if (!currentPw) return setErr(t("needCurrentPw"));
      if (pw.length < 6) return setErr(t("newPwShort"));
      if (pw !== pw2) return setErr(t("pwMismatch"));
    }
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/account", {
        method: "PATCH",
        body: {
          name: name.trim(),
          email: email.trim(),
          mobile,
          inst: instName.trim(),
          type,
          ...(changingPassword ? { currentPw, pw } : {}),
        },
      });
      onChange(data.institution);
      setName(data.institution.admin.name || "");
      setEmail(data.institution.admin.email || "");
      setMobile(data.institution.admin.mobile || "");
      setInstName(data.institution.name || "");
      setType(data.institution.type || "College");
      setCurrentPw("");
      setPw("");
      setPw2("");
      toast(changingPassword ? t("profileAndPassword") : t("profileUpdated"));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("profile")}</p>
          <h1>{name || t("yourAccount")}</h1>
          <p>{t("profileHint")}</p>
        </div>
      </header>
      <form className="stack profile-form" onSubmit={save} noValidate>
        <section className="card">
          <h2>{t("yourDetails")}</h2>
          <ErrBox msg={err} />
          <Field label={t("yourName")}><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <div className="row">
            <Field label={t("emailId")}><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <Field label={t("mobileNumber")}><input inputMode="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} /></Field>
          </div>
        </section>
        <section className="card">
          <h2>{t("institution")}</h2>
          <div className="seg" role="group" aria-label={t("institutionType")}>
            {[["School", "typeSchool"], ["College", "typeCollege"], ["Other", "typeOther"]].map(([value, key]) => (
              <button key={value} type="button" className={type === value ? "on" : ""} onClick={() => setType(value)}>{t(key)}</button>
            ))}
          </div>
          <Field label={type === "Other" ? t("orgName") : t("namedType", { type: t(type === "School" ? "typeSchool" : "typeCollege") })}>
            <input value={instName} onChange={(event) => setInstName(event.target.value)} />
          </Field>
        </section>
        <section className="card">
          <h2>{t("changePassword")}</h2>
          <p className="sub">{t("passwordOptional")}</p>
          <PasswordField label={t("currentPassword")} autoComplete="current-password" placeholder={t("currentPassword")} value={currentPw} onChange={(event) => setCurrentPw(event.target.value)} />
          <div className="row">
            <PasswordField label={t("newPassword")} autoComplete="new-password" value={pw} onChange={(event) => setPw(event.target.value)} />
            <PasswordField label={t("confirmNewPassword")} autoComplete="new-password" value={pw2} onChange={(event) => setPw2(event.target.value)} />
          </div>
          <div className="profile-save">
            <button className="btn brass" disabled={busy}>{busy ? t("saving") : t("saveProfile")}</button>
          </div>
        </section>
      </form>
    </>
  );
}

function SignOut({ compact }) {
  const { t } = useI18n();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    navigate("/");
  };
  if (compact) return <button className="icon-btn light" onClick={logout} aria-label={t("signOut")}><Icon name="logout" /></button>;
  return <button className="nav" onClick={logout}><span className="nav-l"><Icon name="logout" />{t("signOut")}</span></button>;
}

function Overview({ inst, members, setTab }) {
  const { t } = useI18n();
  const list = members || [];
  const week = Date.now() - 7 * 864e5;
  const businesses = list.reduce((sum, member) => {
    const jobs = (member.currentJob?.orgName ? 1 : 0) + (member.previousJob?.orgName ? 1 : 0);
    return sum + (jobs || member.businesses?.length || 0);
  }, 0);
  const cities = new Set(list.map((member) => (member.city || "").trim().toLowerCase()).filter(Boolean)).size;
  const byBatch = [...inst.batches].sort((a, b) => b - a).map((year) => [year, list.filter((member) => sameYear(completedYearOf(member), year)).length]);
  const max = Math.max(1, ...byBatch.map((item) => item[1]));
  const recent = [...list].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 6);

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("overview")}</p>
          <h1>{inst.name}</h1>
          <p>{t("growing")}</p>
        </div>
        <button className="btn brass" onClick={() => setTab("link")}>{t("shareJoinLink")}</button>
      </header>
      <div className="stats">
        <article className="stat">
          <span className="stat-icon"><Icon name="members" /></span>
          <b>{members ? list.length : "–"}</b>
          <span>{t("alumniJoined")}</span>
        </article>
        <article className="stat">
          <span className="stat-icon"><Icon name="batches" /></span>
          <b>{inst.batches.length}</b>
          <span>{t("batches")}</span>
        </article>
        <article className="stat">
          <span className="stat-icon"><Icon name="calendar" /></span>
          <b>{members ? list.filter((member) => member.joinedAt > week).length : "–"}</b>
          <span>{t("joinedThisWeek")}</span>
        </article>
        <article className="stat">
          <span className="stat-icon"><Icon name="pin" /></span>
          <b>{members ? businesses : "–"}</b>
          <span>{t("businessesCities", { n: cities })}</span>
        </article>
      </div>
      {members && list.length === 0 ? (
        <div className="card empty">
          <h2>{t("noAlumniYet")}</h2>
          <p>{inst.batches.length ? t("sharePrompt") : t("addBatchesFirst")}</p>
          <div className="share center">
            <button className="btn" onClick={() => setTab(inst.batches.length ? "link" : "batches")}>{inst.batches.length ? t("getJoinLink") : t("addBatches")}</button>
          </div>
        </div>
      ) : members && (
        <div className="grid2">
          <section className="card">
            <h2>{t("alumniByBatch")}</h2>
            {byBatch.length ? (
              <div className="bars">
                {byBatch.map(([year, count]) => (
                  <div className="bar" key={year}>
                    <b>{year}</b>
                    <div className="track"><i style={{ width: `${(count / max) * 100}%` }} /></div>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            ) : <p className="chart-empty">{t("addBatchChart")}</p>}
          </section>
          <section className="card">
            <h2>{t("recentlyJoined")}</h2>
            <ul className="recent">
              {recent.map((member) => (
                <li key={member.id}>
                  <Avatar name={member.name} photo={member.photo} />
                  <div>
                    <b>{member.name}</b>
                    <small>{t("batchTag", { year: completedYearOf(member) || member.batch })} · {member.city || member.occupation || t("alumni")}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

function Batches({ inst, members, onChange, onOpen }) {
  const { t } = useI18n();
  const toast = useToast();
  const [one, setOne] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const years = [...inst.batches].sort((a, b) => a - b);

  const run = async (body, clear) => {
    setBusy(true);
    try {
      const data = await api("/api/batches", { method: "POST", body });
      onChange(data.institution);
      toast(data.added.length > 1 ? t("batchesAddedMany", { n: data.added.length }) : t("batchesAdded", { n: data.added.length }));
      clear();
      requestAnimationFrame(() => {
        document.querySelector(".spines")?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    } catch (error) {
      toast(error.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const addOne = (event) => {
    event.preventDefault();
    const year = Number(one);
    if (!one || String(year).length !== 4) return toast(t("badYear"), "err");
    run({ years: [year] }, () => setOne(""));
  };

  const addRange = (event) => {
    event.preventDefault();
    const start = Number(from);
    const end = Number(to);
    if (!start || !end || String(start).length !== 4 || String(end).length !== 4) return toast(t("badRange"), "err");
    run({ from: start, to: end }, () => { setFrom(""); setTo(""); });
  };

  const remove = async (year) => {
    if (members.some((member) => sameYear(completedYearOf(member), year))) return toast(t("batchHasAlumni", { year }), "err");
    try {
      const data = await api(`/api/batches/${year}`, { method: "DELETE" });
      onChange(data.institution);
      toast(t("batchRemoved", { year }));
    } catch (error) {
      toast(error.message, "err");
    }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("batches")}</p>
          <h1>{t("whichYears")}</h1>
          <p>{t("eachYear")}</p>
        </div>
      </header>
      <div className="grid2 form-grid">
        <section className="card">
          <form onSubmit={addOne} noValidate>
            <h2>{t("oneYear")}</h2>
            <Field label={t("batchYear")}>
              <input inputMode="numeric" placeholder="2001" value={one} onChange={(event) => setOne(event.target.value)} />
            </Field>
            <button className="btn" disabled={busy}>{t("addBatch")}</button>
          </form>
        </section>
        <section className="card">
          <form onSubmit={addRange} noValidate>
            <h2>{t("rangeYears")}</h2>
            <div className="row">
              <Field label={t("from")}><input inputMode="numeric" placeholder="2001" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
              <Field label={t("to")}><input inputMode="numeric" placeholder="2010" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
            </div>
            <button className="btn ghost" disabled={busy}>{t("addRange")}</button>
          </form>
        </section>
      </div>
      <section className="card batch-shelf">
        <div className="shelf-head">
          <h2>{t("batches")}</h2>
          <span className="count-pill">{years.length}</span>
        </div>
        {years.length ? (
          <>
            <p className="sub tight">{t("tapYearHint")}</p>
            <div className="spines">
              {years.map((year) => (
                <div className="spine" key={year}>
                  <button type="button" className="spine-x" onClick={() => remove(year)} aria-label={t("removeBatch", { year })}>×</button>
                  <button type="button" className="spine-open" onClick={() => onOpen(year)} aria-label={t("openBatchAria", { year })}>
                    <span className="yr">{year}</span>
                    <span className="n">{t("alumniCount", { n: members.filter((member) => sameYear(completedYearOf(member), year)).length })}</span>
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty tight">
            <h2>{t("noBatches")}</h2>
            <p>{t("firstYearHint")}</p>
          </div>
        )}
      </section>
    </>
  );
}

function JoinLink({ inst, onChange }) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const url = joinUrl(inst.code);
  const message = encodeURIComponent(t("waMessage", { name: inst.name, url }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("linkCopied"));
    } catch {
      toast(t("copyManually"));
    }
  };

  const renew = async () => {
    if (!window.confirm(t("confirmRenew"))) return;
    try {
      const data = await api("/api/institution/code", { method: "POST" });
      onChange(data.institution);
      toast(t("newLinkReady"));
    } catch (error) {
      toast(error.message, "err");
    }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("joinLink")}</p>
          <h1>{t("inviteAlumni")}</h1>
          <p>{t("inviteHint")}</p>
        </div>
      </header>
      <section className="card">
        {!inst.batches.length && <ErrBox msg={t("needBatch")} />}
        <div className="link-feature">
          <p className="eyebrow light">{t("joinLink")}</p>
          <code>{url}</code>
          <button className="btn brass" onClick={copy}>{t("copyLink")}</button>
        </div>
        <div className="share">
          <a className="btn ghost sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${message}`}>{t("whatsapp")}</a>
          <a className="btn ghost sm" href={`mailto:?subject=${encodeURIComponent(t("alumniSubject", { name: inst.name }))}&body=${message}`}>{t("email")}</a>
          <button className="btn ghost sm" onClick={() => navigate(`/join/${inst.code}?preview=1`)}>{t("openJoinForm")}</button>
          <button className="btn ghost sm" onClick={renew}>{t("newLink")}</button>
        </div>
        <p className="sub tight">
          {t("yearsInForm")}{" "}
          {inst.batches.length
            ? [...inst.batches].sort((a, b) => a - b).map((year) => <span key={year} className="tag">{year}</span>)
            : t("noneYet")}
        </p>
      </section>
    </>
  );
}

function roleLine(member, t) {
  return member.currentJob?.designation
    || member.occupation
    || member.qualification
    || t("alumni");
}

function placeLine(member, t) {
  return member.currentJob?.orgName
    || member.businesses?.[0]?.name
    || member.city
    || t("cityNotSet");
}

function yearKey(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const num = Number(text);
  return Number.isFinite(num) ? num : text;
}

function completedYearOf(member) {
  const completed = String(member?.yearCompleted ?? "").trim();
  if (completed) return yearKey(completed);
  if (member?.batch != null && String(member.batch).trim() !== "") return yearKey(member.batch);
  return "";
}

function sameYear(a, b) {
  const left = yearKey(a);
  const right = yearKey(b);
  return left !== "" && left === right;
}

function byUpdate(a, b) {
  const pending = (member) => member.identityRequest?.requestedAt || 0;
  const updateDelta = pending(b) - pending(a);
  if (updateDelta) return updateDelta;
  return (b.joinedAt || 0) - (a.joinedAt || 0);
}

function Members({ inst, members, setTab, onRemove, onUpdate, focusYear, reload }) {
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState(() => (focusYear == null ? "" : String(yearKey(focusYear))));
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(null);
  const list = members || [];

  useEffect(() => {
    setYear(focusYear == null ? "" : String(yearKey(focusYear)));
  }, [focusYear]);

  const years = useMemo(
    () => [...new Set([...(inst.batches || []).map(yearKey), ...list.map(completedYearOf)])]
      .filter((value) => value !== "")
      .sort((a, b) => b - a),
    [inst.batches, list],
  );

  const cities = useMemo(() => {
    const seen = new Map();
    list.forEach((member) => {
      const name = (member.city || "").trim();
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [list]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (member) => !needle || [
      member.memberNo, member.name, member.email, member.mobile, member.city, member.occupation,
      member.qualification, member.yearCompleted, member.batch, member.currentJob?.orgName, member.currentJob?.designation,
      member.previousJob?.orgName, member.spouseName,
      ...(member.businesses || []).map((item) => item.name),
    ].join(" ").toLowerCase().includes(needle);
    return list
      .filter((member) => (!year || sameYear(completedYearOf(member), year))
        && (!city || (member.city || "").trim().toLowerCase() === city.toLowerCase())
        && matches(member))
      .sort((a, b) => (completedYearOf(b) || 0) - (completedYearOf(a) || 0) || byUpdate(a, b));
  }, [list, query, year, city]);

  const filtered = !!(query.trim() || year || city);
  const clearFilters = () => { setQuery(""); setYear(""); setCity(""); };

  const openMember = list.find((member) => member.id === open);

  const remove = async () => {
    if (!openMember || !window.confirm(t("confirmRemove", { name: openMember.name }))) return;
    try {
      await api(`/api/members/${openMember.id}`, { method: "DELETE" });
      onRemove(openMember.id);
      setOpen(null);
      toast(t("removed"));
    } catch (error) {
      toast(error.message, "err");
    }
  };

  const exportFile = async () => {
    try { await downloadCsv(); }
    catch (error) { toast(error.message, "err"); }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("directory")}</p>
          <h1>{t("alumni")}</h1>
          <p>{year ? t("showingCompleted", { year, n: rows.length }) : t("joinedAcross", { n: list.length, b: inst.batches.length })}</p>
        </div>
        <button className="btn ghost" disabled={!list.length} onClick={exportFile}>{t("exportCsv")}</button>
      </header>
      {!members ? <div className="card empty"><p>{t("loadingAlumni")}</p></div> : !inst.batches.length && !list.length ? (
        <div className="card empty">
          <h2>{t("nobodyJoined")}</h2>
          <p>{t("shareSoRegister")}</p>
          <div className="share center">
            <button className="btn" onClick={() => setTab("link")}>{t("getJoinLink")}</button>
          </div>
        </div>
      ) : (
        <section className="dir-card">
          <div className="dir-toolbar">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input placeholder={t("searchPh")} aria-label={t("searchAlumni")} value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className="dir-select">
              <span>{t("yearCompleted")}</span>
              <select value={year} onChange={(event) => { setYear(event.target.value); reload?.(); }}>
                <option value="">{t("allBatches")} ({list.length})</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value} ({list.filter((member) => sameYear(completedYearOf(member), value)).length})
                  </option>
                ))}
              </select>
            </label>
            <label className="dir-select">
              <span>{t("city")}</span>
              <select value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="">{t("all")}</option>
                {cities.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            {filtered && <button type="button" className="dir-clear" onClick={clearFilters}>✕</button>}
            <span className="match-line">{t("alumniCount", { n: rows.length })}</span>
          </div>
          {rows.length ? (
            <div className="dir-scroll">
              <table className="dir-table">
                <thead>
                  <tr>
                    <th>{t("name")}</th>
                    <th>{t("yearCompleted")}</th>
                    <th>{t("mobileNumber")}</th>
                    <th>{t("emailId")}</th>
                    <th>{t("city")}</th>
                    <th>{t("designation")}</th>
                    <th>{t("currentJob")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => (
                    <tr key={member.id} tabIndex={0} onClick={() => setOpen(member.id)} onKeyDown={(event) => { if (event.key === "Enter") setOpen(member.id); }}>
                      <td>
                        <div className="dir-person">
                          <Avatar name={member.name} photo={member.photo} />
                          <div>
                            <b>{member.name}</b>
                            {member.memberNo && <small className="alum-no">{member.memberNo}</small>}
                            {member.identityRequest && <span className="pending-badge">{t("updateRequested")}</span>}
                          </div>
                        </div>
                      </td>
                      <td><span className="yr-pill">{completedYearOf(member) || "–"}</span></td>
                      <td>{member.mobile || "–"}</td>
                      <td className="dir-email">{member.email || "–"}</td>
                      <td>{member.city || "–"}</td>
                      <td>{member.currentJob?.designation || member.occupation || member.qualification || "–"}</td>
                      <td>{member.currentJob?.orgName || member.businesses?.[0]?.name || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty tight"><h2>{filtered ? t("noMatches") : t("nobodyJoined")}</h2><p>{filtered ? t("tryDifferent") : t("shareSoRegister")}</p></div>
          )}
        </section>
      )}
      {openMember && (
        <Drawer title={openMember.name} onClose={() => setOpen(null)}>
          <MemberProfile member={openMember} />
          <IdentityEditor member={openMember} onSaved={onUpdate} />
          <div className="d-sec">
            <button className="btn danger sm" onClick={remove}>{t("removeFromList")}</button>
          </div>
        </Drawer>
      )}
    </>
  );
}

function IdentityEditor({ member, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const pending = member.identityRequest;
  const [name, setName] = useState(member.name || "");
  const [email, setEmail] = useState(member.email || "");
  const [mobile, setMobile] = useState(member.mobile || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(member.name || "");
    setEmail(member.email || "");
    setMobile(member.mobile || "");
    setErr("");
  }, [member.id, member.name, member.email, member.mobile]);

  const save = async (event) => {
    event.preventDefault();
    if (!name.trim()) return setErr(t("enterName"));
    if (!isEmail(email)) return setErr(t("badEmail"));
    if (!isMobile(mobile)) return setErr(t("badMobile"));
    setBusy(true);
    setErr("");
    try {
      const data = await api(`/api/members/${member.id}`, {
        method: "PATCH",
        body: { name: name.trim(), email: email.trim(), mobile },
      });
      onSaved(data.member);
      toast(t("identitySaved"));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (action) => {
    setBusy(true);
    setErr("");
    try {
      const data = await api(`/api/members/${member.id}`, { method: "PATCH", body: { action } });
      onSaved(data.member);
      toast(t(action === "approve" ? "identityApproved" : "identityRejected"));
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="d-sec" onSubmit={save} noValidate>
      <h3>{t("adminEditIdentity")}</h3>
      <p className="sub">{t("adminEditIdentityHint")}</p>
      {pending && (
        <div className="note">
          {t("identityPending")}: {pending.name} · {pending.email} · {pending.mobile}
        </div>
      )}
      <ErrBox msg={err} />
      <Field label={t("fullName")}><input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label={t("emailId")}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
      <Field label={t("mobileNumber")}><input inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} /></Field>
      <div className="wizard-actions">
        {pending && (
          <>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => decide("reject")}>{t("rejectUpdate")}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => decide("approve")}>{t("approveUpdate")}</button>
          </>
        )}
        <button className="btn brass" disabled={busy}>{busy ? t("saving") : t("saveIdentity")}</button>
      </div>
    </form>
  );
}
