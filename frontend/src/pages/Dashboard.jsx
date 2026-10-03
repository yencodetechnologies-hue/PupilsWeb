import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadCsv } from "../api";
import { joinUrl } from "../site";
import { Avatar, Brand, Drawer, ErrBox, Field, Icon, MemberProfile, PasswordField } from "../components";
import { formatDate, LangToggle, typeLabel, useI18n } from "../i18n";
import { useAuth, useToast } from "../state";

const TABS = [
  ["overview", "overview"],
  ["batches", "batches"],
  ["link", "joinLink"],
  ["members", "alumni"],
  ["profile", "profile"],
];

export function Dashboard() {
  const { t } = useI18n();
  const { session, updateInstitution } = useAuth();
  const toast = useToast();
  const inst = session.institution;
  const [tab, setTab] = useState(inst.batches.length ? "overview" : "batches");
  const [members, setMembers] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  const loadMembers = () => {
    api("/api/members")
      .then((data) => setMembers(data.members))
      .catch((error) => setLoadErr(error.message));
  };

  useEffect(() => { loadMembers(); }, []);

  const applyInst = (institution) => updateInstitution(institution);

  const go = (key) => { setTab(key); window.scrollTo(0, 0); };
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
          {tab === "batches" && <Batches inst={inst} members={members || []} onChange={applyInst} />}
          {tab === "link" && <JoinLink inst={inst} onChange={applyInst} />}
          {tab === "members" && <Members inst={inst} members={members} setTab={go} onRemove={(id) => setMembers((list) => list.filter((item) => item.id !== id))} />}
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
      <form className="card profile-form" onSubmit={save} noValidate>
        <ErrBox msg={err} />
        <h2>{t("yourDetails")}</h2>
        <Field label={t("yourName")}><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <div className="row">
          <Field label={t("emailId")}><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label={t("mobileNumber")}><input inputMode="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} /></Field>
        </div>
        <div className="profile-block">
          <h3>{t("institution")}</h3>
          <div className="seg" role="group" aria-label={t("institutionType")}>
            {[["School", "typeSchool"], ["College", "typeCollege"], ["Other", "typeOther"]].map(([value, key]) => (
              <button key={value} type="button" className={type === value ? "on" : ""} onClick={() => setType(value)}>{t(key)}</button>
            ))}
          </div>
          <Field label={type === "Other" ? t("orgName") : t("namedType", { type: t(type === "School" ? "typeSchool" : "typeCollege") })}>
            <input value={instName} onChange={(event) => setInstName(event.target.value)} />
          </Field>
        </div>
        <div className="profile-block">
          <h3>{t("changePassword")}</h3>
          <p className="sub">{t("passwordOptional")}</p>
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
  const businesses = list.reduce((sum, member) => sum + (member.businesses?.length || 0), 0);
  const cities = new Set(list.map((member) => (member.city || "").trim().toLowerCase()).filter(Boolean)).size;
  const byBatch = [...inst.batches].sort((a, b) => b - a).map((year) => [year, list.filter((member) => member.batch === year).length]);
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
        <article className="stat"><b>{members ? list.length : "–"}</b><span>{t("alumniJoined")}</span></article>
        <article className="stat"><b>{inst.batches.length}</b><span>{t("batches")}</span></article>
        <article className="stat"><b>{members ? list.filter((member) => member.joinedAt > week).length : "–"}</b><span>{t("joinedThisWeek")}</span></article>
        <article className="stat"><b>{members ? businesses : "–"}</b><span>{t("businessesCities", { n: cities })}</span></article>
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
            ) : <p className="muted">{t("addBatchChart")}</p>}
          </section>
          <section className="card">
            <h2>{t("recentlyJoined")}</h2>
            <ul className="recent">
              {recent.map((member) => (
                <li key={member.id}>
                  <Avatar name={member.name} photo={member.photo} />
                  <div>
                    <b>{member.name}</b>
                    <small>{t("batchTag", { year: member.batch })} · {member.city || member.occupation || t("alumni")}</small>
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

function Batches({ inst, members, onChange }) {
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
      toast(error.message);
    } finally {
      setBusy(false);
    }
  };

  const addOne = (event) => {
    event.preventDefault();
    const year = Number(one);
    if (!one || String(year).length !== 4) return toast(t("badYear"));
    run({ years: [year] }, () => setOne(""));
  };

  const addRange = (event) => {
    event.preventDefault();
    const start = Number(from);
    const end = Number(to);
    if (!start || !end || String(start).length !== 4 || String(end).length !== 4) return toast(t("badRange"));
    run({ from: start, to: end }, () => { setFrom(""); setTo(""); });
  };

  const remove = async (year) => {
    if (members.some((member) => member.batch === year)) return toast(t("batchHasAlumni", { year }));
    try {
      const data = await api(`/api/batches/${year}`, { method: "DELETE" });
      onChange(data.institution);
      toast(t("batchRemoved", { year }));
    } catch (error) {
      toast(error.message);
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
      <section className="card">
        <div className="split-form">
          <form onSubmit={addOne} noValidate>
            <h2>{t("oneYear")}</h2>
            <Field label={t("batchYear")}>
              <input inputMode="numeric" placeholder="2001" value={one} onChange={(event) => setOne(event.target.value)} />
            </Field>
            <button className="btn" disabled={busy}>{t("addBatch")}</button>
          </form>
          <form onSubmit={addRange} noValidate>
            <h2>{t("rangeYears")}</h2>
            <div className="row">
              <Field label={t("from")}><input inputMode="numeric" placeholder="2001" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
              <Field label={t("to")}><input inputMode="numeric" placeholder="2010" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
            </div>
            <button className="btn ghost" disabled={busy}>{t("addRange")}</button>
          </form>
        </div>
        {years.length ? (
          <div className="spines">
            {years.map((year) => (
              <div className="spine" key={year}>
                <button type="button" onClick={() => remove(year)} aria-label={t("removeBatch", { year })}>×</button>
                <span className="yr">{year}</span>
                <span className="n">{t("alumniCount", { n: members.filter((member) => member.batch === year).length })}</span>
              </div>
            ))}
          </div>
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
      toast(error.message);
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
        <div className="linkbox">
          <code>{url}</code>
          <button className="btn sm" onClick={copy}>{t("copyLink")}</button>
        </div>
        <div className="share">
          <a className="btn ghost sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${message}`}>{t("whatsapp")}</a>
          <a className="btn ghost sm" href={`mailto:?subject=${encodeURIComponent(t("alumniSubject", { name: inst.name }))}&body=${message}`}>{t("email")}</a>
          <button className="btn brass sm" onClick={() => navigate(`/join/${inst.code}?preview=1`)}>{t("openJoinForm")}</button>
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

function Members({ inst, members, setTab, onRemove }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const list = members || [];

  const shown = useMemo(() => {
    const needle = query.toLowerCase();
    return list.filter((member) =>
      (filter === "all" || member.batch === Number(filter)) &&
      (!needle || [member.name, member.email, member.mobile, member.city, member.occupation, ...(member.businesses || []).map((item) => item.name)].join(" ").toLowerCase().includes(needle))
    );
  }, [list, query, filter]);

  const years = [...new Set(shown.map((member) => member.batch))].sort((a, b) => b - a);
  const openMember = list.find((member) => member.id === open);

  const remove = async () => {
    if (!openMember || !window.confirm(t("confirmRemove", { name: openMember.name }))) return;
    try {
      await api(`/api/members/${openMember.id}`, { method: "DELETE" });
      onRemove(openMember.id);
      setOpen(null);
      toast(t("removed"));
    } catch (error) {
      toast(error.message);
    }
  };

  const exportFile = async () => {
    try { await downloadCsv(); }
    catch (error) { toast(error.message); }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("directory")}</p>
          <h1>{t("alumni")}</h1>
          <p>{t("joinedAcross", { n: list.length, b: inst.batches.length })}</p>
        </div>
        <button className="btn ghost" disabled={!list.length} onClick={exportFile}>{t("exportCsv")}</button>
      </header>
      <div className="toolbar">
        <input placeholder={t("searchPh")} aria-label={t("searchAlumni")} value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label={t("filterBatch")} value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">{t("allBatches")}</option>
          {[...inst.batches].sort((a, b) => b - a).map((year) => <option key={year} value={year}>{t("batchTag", { year })}</option>)}
        </select>
      </div>
      {!members ? <div className="card empty"><p>{t("loadingAlumni")}</p></div> : !list.length ? (
        <div className="card empty">
          <h2>{t("nobodyJoined")}</h2>
          <p>{t("shareSoRegister")}</p>
          <div className="share center">
            <button className="btn" onClick={() => setTab("link")}>{t("getJoinLink")}</button>
          </div>
        </div>
      ) : !shown.length ? (
        <div className="card empty"><h2>{t("noMatches")}</h2><p>{t("tryDifferent")}</p></div>
      ) : years.map((year) => {
        const group = shown.filter((member) => member.batch === year).sort((a, b) => a.name.localeCompare(b.name));
        return (
          <section className="batch-group" key={year}>
            <div className="bg-head"><h2>{t("batchTag", { year })}</h2><span>{group.length} {group.length === 1 ? t("oneMember") : t("manyMembers")}</span></div>
            <div className="tablewrap only-desktop">
              <table>
                <thead>
                  <tr><th>{t("name")}</th><th>{t("contact")}</th><th>{t("city")}</th><th>{t("work")}</th><th>{t("joined")}</th><th></th></tr>
                </thead>
                <tbody>
                  {group.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="who">
                          <Avatar name={member.name} photo={member.photo} />
                          <div><b>{member.name}</b><small>{member.qualification}</small></div>
                        </div>
                      </td>
                      <td>{member.mobile}<small>{member.email}</small></td>
                      <td>{member.city || "—"}</td>
                      <td>{member.businesses?.[0]?.name ? <span className="tag">{member.businesses[0].name}</span> : (member.occupation || "—")}</td>
                      <td><small>{formatDate(lang, member.joinedAt)}</small></td>
                      <td><button className="btn ghost sm" onClick={() => setOpen(member.id)}>{t("view")}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="person-list only-mobile">
              {group.map((member) => (
                <button type="button" className="person" key={member.id} onClick={() => setOpen(member.id)}>
                  <div className="who">
                    <Avatar name={member.name} photo={member.photo} />
                    <div>
                      <b>{member.name}</b>
                      <small>{member.city || t("cityNotSet")} · {member.occupation || member.businesses?.[0]?.name || t("alumni")}</small>
                    </div>
                  </div>
                  <Icon name="chevron" size={18} />
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {openMember && (
        <Drawer title={openMember.name} onClose={() => setOpen(null)}>
          <MemberProfile member={openMember} />
          <div className="d-sec">
            <button className="btn danger sm" onClick={remove}>{t("removeFromList")}</button>
          </div>
        </Drawer>
      )}
    </>
  );
}
