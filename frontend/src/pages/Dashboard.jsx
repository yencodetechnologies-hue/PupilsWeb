import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadCsv } from "../api";
import { joinUrl } from "../site";
import { Avatar, Brand, Drawer, ErrBox, Field, Icon, MemberProfile } from "../components";
import { useAuth, useToast } from "../state";

const TABS = [
  ["overview", "Overview"],
  ["batches", "Batches"],
  ["link", "Join link"],
  ["members", "Alumni"],
];

export function Dashboard() {
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
      <span className="nav-l"><Icon name={key} />{label}</span>
      {countFor(key) !== null && <span className="count">{countFor(key)}</span>}
    </button>
  ));

  return (
    <div className="app">
      <aside className="side">
        <Brand />
        <div className="inst">
          <b>{inst.name}</b>
          <small>{inst.type} · {inst.admin.name}</small>
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
            <small>{inst.type} · {inst.admin.name}</small>
          </div>
          <SignOut compact />
        </header>
        <main className="main">
          {loadErr && <ErrBox msg={loadErr} />}
          {tab === "overview" && <Overview inst={inst} members={members} setTab={go} onSeeded={(data) => { applyInst(data.institution); setMembers(data.members); }} />}
          {tab === "batches" && <Batches inst={inst} members={members || []} onChange={applyInst} />}
          {tab === "link" && <JoinLink inst={inst} onChange={applyInst} />}
          {tab === "members" && <Members inst={inst} members={members} setTab={go} onSeeded={(data) => { applyInst(data.institution); setMembers(data.members); }} onRemove={(id) => setMembers((list) => list.filter((item) => item.id !== id))} />}
        </main>
        <nav className="tabbar" aria-label="Sections">
          {TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? "on" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => go(key)}>
              <span className="tb-icon">
                <Icon name={key} size={22} />
                {key === "members" && !!members?.length && <i className="dot">{members.length}</i>}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function SignOut({ compact }) {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    navigate("/");
  };
  if (compact) return <button className="icon-btn light" onClick={logout} aria-label="Sign out"><Icon name="logout" /></button>;
  return <button className="nav" onClick={logout}><span className="nav-l"><Icon name="logout" />Sign out</span></button>;
}

async function seed(toast, onSeeded) {
  const data = await api("/api/seed", { method: "POST" });
  onSeeded(data);
  toast(data.added ? "Sample alumni loaded. Sample password is 123456." : "Sample alumni are already in this list.");
}

function Overview({ inst, members, setTab, onSeeded }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const list = members || [];
  const week = Date.now() - 7 * 864e5;
  const businesses = list.reduce((sum, member) => sum + (member.businesses?.length || 0), 0);
  const cities = new Set(list.map((member) => (member.city || "").trim().toLowerCase()).filter(Boolean)).size;
  const byBatch = [...inst.batches].sort((a, b) => b - a).map((year) => [year, list.filter((member) => member.batch === year).length]);
  const max = Math.max(1, ...byBatch.map((item) => item[1]));
  const recent = [...list].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 6);

  const load = async () => {
    setBusy(true);
    try { await seed(toast, onSeeded); }
    catch (error) { toast(error.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{inst.name}</h1>
          <p>Here's how your alumni network is growing.</p>
        </div>
        <button className="btn brass" onClick={() => setTab("link")}>Share join link</button>
      </header>
      <div className="stats">
        <article className="stat"><b>{members ? list.length : "–"}</b><span>Alumni joined</span></article>
        <article className="stat"><b>{inst.batches.length}</b><span>Batches</span></article>
        <article className="stat"><b>{members ? list.filter((member) => member.joinedAt > week).length : "–"}</b><span>Joined this week</span></article>
        <article className="stat"><b>{members ? businesses : "–"}</b><span>Businesses · {cities} cities</span></article>
      </div>
      {members && list.length === 0 ? (
        <div className="card empty">
          <h2>No alumni yet</h2>
          <p>{inst.batches.length ? "Share your join link and classmates can register themselves." : "Add your batches first, then share the join link."}</p>
          <div className="share center">
            <button className="btn" onClick={() => setTab(inst.batches.length ? "link" : "batches")}>{inst.batches.length ? "Get join link" : "Add batches"}</button>
            <button className="btn ghost" disabled={busy} onClick={load}>{busy ? "Loading…" : "Load sample alumni"}</button>
          </div>
        </div>
      ) : members && (
        <div className="grid2">
          <section className="card">
            <h2>Alumni by batch</h2>
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
            ) : <p className="muted">Add a batch to see this chart.</p>}
          </section>
          <section className="card">
            <h2>Recently joined</h2>
            <ul className="recent">
              {recent.map((member) => (
                <li key={member.id}>
                  <Avatar name={member.name} photo={member.photo} />
                  <div>
                    <b>{member.name}</b>
                    <small>Batch {member.batch} · {member.city || member.occupation || "Alumni"}</small>
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
      toast(`${data.added.length} batch${data.added.length > 1 ? "es" : ""} added`);
      clear();
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  };

  const addOne = (event) => {
    event.preventDefault();
    const year = Number(one);
    if (!one || String(year).length !== 4) return toast("Enter a 4-digit year, like 2001");
    run({ years: [year] }, () => setOne(""));
  };

  const addRange = (event) => {
    event.preventDefault();
    const start = Number(from);
    const end = Number(to);
    if (!start || !end || String(start).length !== 4 || String(end).length !== 4) return toast("Enter a valid range, like 2001 to 2010");
    run({ from: start, to: end }, () => { setFrom(""); setTo(""); });
  };

  const remove = async (year) => {
    if (members.some((member) => member.batch === year)) return toast(`Batch ${year} has alumni and can't be removed`);
    try {
      const data = await api(`/api/batches/${year}`, { method: "DELETE" });
      onChange(data.institution);
      toast(`Batch ${year} removed`);
    } catch (error) {
      toast(error.message);
    }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">Batches</p>
          <h1>Which years can join?</h1>
          <p>Each year shows up in the join form.</p>
        </div>
      </header>
      <section className="card">
        <div className="split-form">
          <form onSubmit={addOne} noValidate>
            <h2>One year</h2>
            <Field label="Batch year">
              <input inputMode="numeric" placeholder="2001" value={one} onChange={(event) => setOne(event.target.value)} />
            </Field>
            <button className="btn" disabled={busy}>Add batch</button>
          </form>
          <form onSubmit={addRange} noValidate>
            <h2>A range of years</h2>
            <div className="row">
              <Field label="From"><input inputMode="numeric" placeholder="2001" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
              <Field label="To"><input inputMode="numeric" placeholder="2010" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
            </div>
            <button className="btn ghost" disabled={busy}>Add range</button>
          </form>
        </div>
        {years.length ? (
          <div className="spines">
            {years.map((year) => (
              <div className="spine" key={year}>
                <button type="button" onClick={() => remove(year)} aria-label={`Remove batch ${year}`}>×</button>
                <span className="yr">{year}</span>
                <span className="n">{members.filter((member) => member.batch === year).length} alumni</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty tight">
            <h2>No batches yet</h2>
            <p>Add the first year, for example 2001, 2003 or 2004.</p>
          </div>
        )}
      </section>
    </>
  );
}

function JoinLink({ inst, onChange }) {
  const toast = useToast();
  const navigate = useNavigate();
  const url = joinUrl(inst.code);
  const message = encodeURIComponent(`Hi! Join the ${inst.name} alumni network and reconnect with your batch: ${url}`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Select the link and copy it");
    }
  };

  const renew = async () => {
    if (!window.confirm("Generate a new link? The current one will stop working.")) return;
    try {
      const data = await api("/api/institution/code", { method: "POST" });
      onChange(data.institution);
      toast("New link generated. The old link no longer works.");
    } catch (error) {
      toast(error.message);
    }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">Join link</p>
          <h1>Invite your alumni</h1>
          <p>Anyone with this link can pick a batch and register.</p>
        </div>
      </header>
      <section className="card">
        {!inst.batches.length && <ErrBox msg="Add at least one batch first so people can choose it in the form." />}
        <div className="linkbox">
          <code>{url}</code>
          <button className="btn sm" onClick={copy}>Copy link</button>
        </div>
        <div className="share">
          <a className="btn ghost sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${message}`}>WhatsApp</a>
          <a className="btn ghost sm" href={`mailto:?subject=${encodeURIComponent(`${inst.name} Alumni`)}&body=${message}`}>Email</a>
          <button className="btn brass sm" onClick={() => navigate(`/join/${inst.code}?preview=1`)}>Open the join form</button>
          <button className="btn ghost sm" onClick={renew}>New link</button>
        </div>
        <p className="sub tight">
          Years in the form:{" "}
          {inst.batches.length
            ? [...inst.batches].sort((a, b) => a - b).map((year) => <span key={year} className="tag">{year}</span>)
            : "none yet"}
        </p>
      </section>
    </>
  );
}

function Members({ inst, members, setTab, onSeeded, onRemove }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
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
    if (!openMember || !window.confirm(`Remove ${openMember.name} from the alumni list?`)) return;
    try {
      await api(`/api/members/${openMember.id}`, { method: "DELETE" });
      onRemove(openMember.id);
      setOpen(null);
      toast("Removed");
    } catch (error) {
      toast(error.message);
    }
  };

  const load = async () => {
    setBusy(true);
    try { await seed(toast, onSeeded); }
    catch (error) { toast(error.message); }
    finally { setBusy(false); }
  };

  const exportFile = async () => {
    try { await downloadCsv(); }
    catch (error) { toast(error.message); }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">Directory</p>
          <h1>Alumni</h1>
          <p>{list.length} joined across {inst.batches.length} batches.</p>
        </div>
        <button className="btn ghost" disabled={!list.length} onClick={exportFile}>Export CSV</button>
      </header>
      <div className="toolbar">
        <input placeholder="Search name, mobile, city, business" aria-label="Search alumni" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter by batch" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All batches</option>
          {[...inst.batches].sort((a, b) => b - a).map((year) => <option key={year} value={year}>Batch {year}</option>)}
        </select>
      </div>
      {!members ? <div className="card empty"><p>Loading alumni…</p></div> : !list.length ? (
        <div className="card empty">
          <h2>No one has joined yet</h2>
          <p>Share your join link, or load sample alumni to preview this list.</p>
          <div className="share center">
            <button className="btn" onClick={() => setTab("link")}>Get join link</button>
            <button className="btn ghost" disabled={busy} onClick={load}>{busy ? "Loading…" : "Load sample alumni"}</button>
          </div>
        </div>
      ) : !shown.length ? (
        <div className="card empty"><h2>No matches</h2><p>Try a different name or batch.</p></div>
      ) : years.map((year) => {
        const group = shown.filter((member) => member.batch === year).sort((a, b) => a.name.localeCompare(b.name));
        return (
          <section className="batch-group" key={year}>
            <div className="bg-head"><h2>Batch {year}</h2><span>{group.length} {group.length === 1 ? "member" : "members"}</span></div>
            <div className="tablewrap only-desktop">
              <table>
                <thead>
                  <tr><th>Name</th><th>Contact</th><th>City</th><th>Work</th><th>Joined</th><th></th></tr>
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
                      <td><small>{new Date(member.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></td>
                      <td><button className="btn ghost sm" onClick={() => setOpen(member.id)}>View</button></td>
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
                      <small>{member.city || "City not set"} · {member.occupation || member.businesses?.[0]?.name || "Alumni"}</small>
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
            <button className="btn danger sm" onClick={remove}>Remove from list</button>
          </div>
        </Drawer>
      )}
    </>
  );
}
