import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Avatar, ErrBox, Field } from "./components";
import { useI18n } from "./i18n";
import { ProfileRecord } from "./memberForm";
import { useAuth, useToast } from "./state";

const sub = (person, t) =>
  [person.occupation, person.company, (person.yearCompleted || person.batch) ? t("batchTag", { year: person.yearCompleted || person.batch }) : "", person.city]
    .filter(Boolean).join(" · ");

function PersonCard({ person, children, onOpen }) {
  const { t } = useI18n();
  return (
    <div className="net-card">
      <button type="button" className="net-who" onClick={onOpen}>
        <Avatar name={person.name} photo={person.photo} />
        <span><b>{person.name}</b><small>{sub(person, t) || t("batchmate")}</small></span>
      </button>
      <div className="net-actions">{children}</div>
    </div>
  );
}

export function Network() {
  const { t } = useI18n();
  const { session } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("discover");
  const [net, setNet] = useState({ connections: [], incoming: [], outgoing: [] });
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [picked, setPicked] = useState(null);
  const [err, setErr] = useState("");

  const loadNet = useCallback(() => {
    api("/api/me/network").then(setNet).catch((error) => setErr(error.message));
  }, []);
  useEffect(() => { loadNet(); }, [loadNet]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const path = query.trim() ? `/api/me/alumni?q=${encodeURIComponent(query.trim())}` : "/api/me/batchmates";
      api(path)
        .then((data) => { setPeople(data.alumni || data.batchmates || []); setErr(""); })
        .catch((error) => { setPeople([]); setErr(error.message); });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const run = async (fn, message) => {
    try {
      await fn();
      if (message) toast(message);
      loadNet();
    } catch (error) {
      toast(error.message, "err");
    }
  };

  const statusOf = (id) => {
    const connected = net.connections.find((item) => item.member.id === id);
    if (connected) return ["connected", connected.id];
    const out = net.outgoing.find((item) => item.member.id === id);
    if (out) return ["sent", out.id];
    const inc = net.incoming.find((item) => item.member.id === id);
    if (inc) return ["incoming", inc.id];
    return ["none", null];
  };

  const connectBtn = (person) => {
    const [status, linkId] = statusOf(person.id);
    if (status === "connected") return <span className="applied-pill">✓ {t("connected")}</span>;
    if (status === "sent") return <button type="button" className="btn ghost sm" onClick={() => run(() => api(`/api/me/connections/${linkId}`, { method: "DELETE" }), t("requestWithdrawn"))}>{t("pending")}</button>;
    if (status === "incoming") return <button type="button" className="btn brass sm" onClick={() => run(() => api(`/api/me/connections/${linkId}/accept`, { method: "POST" }), t("nowConnected"))}>{t("accept")}</button>;
    return <button type="button" className="btn brass sm" onClick={() => run(() => api("/api/me/connections", { method: "POST", body: { to: person.id } }), t("requestSent"))}>+ {t("connect")}</button>;
  };

  const tabs = [
    ["discover", t("discover"), null],
    ["requests", t("requests"), net.incoming.length],
    ["mine", t("myNetwork"), net.connections.length],
  ];

  return (
    <section className="card no-print">
      <h2>{t("network")}</h2>
      <p className="sub">{t("networkHint")}</p>
      <div className="ev-tabs">
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" className={tab === key ? "on" : ""} onClick={() => { setTab(key); setPicked(null); }}>
            {label}{count !== null && <small>{count}</small>}
          </button>
        ))}
      </div>
      <ErrBox msg={err} />

      {tab === "discover" && (
        <>
          <Field label={t("searchFriends")}>
            <input value={query} placeholder={t("searchFriendsPh")} onChange={(event) => setQuery(event.target.value)} />
          </Field>
          <div className="net-grid">
            {people.map((person) => (
              <PersonCard key={person.id} person={{ ...person, occupation: person.occupation || person.currentJob?.designation, company: person.currentJob?.orgName }} onOpen={() => setPicked(person)}>
                {connectBtn(person)}
              </PersonCard>
            ))}
          </div>
          {!people.length && <p className="muted">{query.trim() ? t("noFriends") : t("noBatchmates")}</p>}
        </>
      )}

      {tab === "requests" && (
        <>
          <h3 className="net-h">{t("received")}</h3>
          <div className="net-grid">
            {net.incoming.map((item) => (
              <PersonCard key={item.id} person={item.member}>
                <button type="button" className="btn brass sm" onClick={() => run(() => api(`/api/me/connections/${item.id}/accept`, { method: "POST" }), t("nowConnected"))}>{t("accept")}</button>
                <button type="button" className="btn ghost sm" onClick={() => run(() => api(`/api/me/connections/${item.id}`, { method: "DELETE" }))}>{t("decline")}</button>
              </PersonCard>
            ))}
          </div>
          {!net.incoming.length && <p className="muted">{t("noRequests")}</p>}
          <h3 className="net-h">{t("sent")}</h3>
          <div className="net-grid">
            {net.outgoing.map((item) => (
              <PersonCard key={item.id} person={item.member}>
                <button type="button" className="btn ghost sm" onClick={() => run(() => api(`/api/me/connections/${item.id}`, { method: "DELETE" }), t("requestWithdrawn"))}>{t("withdraw")}</button>
              </PersonCard>
            ))}
          </div>
          {!net.outgoing.length && <p className="muted">{t("noSent")}</p>}
        </>
      )}

      {tab === "mine" && (
        <>
          <div className="net-grid">
            {net.connections.map((item) => (
              <PersonCard key={item.id} person={item.member} onOpen={() => setPicked(item.member)}>
                <button type="button" className="btn ghost sm" onClick={() => window.confirm(t("confirmDisconnect")) && run(() => api(`/api/me/connections/${item.id}`, { method: "DELETE" }))}>{t("remove")}</button>
              </PersonCard>
            ))}
          </div>
          {!net.connections.length && <p className="muted">{t("noConnections")}</p>}
        </>
      )}

      {picked && (
        <div className="friend-record">
          <div className="sec-h">
            <h2>{picked.name}</h2>
            <button type="button" className="btn ghost sm" onClick={() => setPicked(null)}>{t("close")}</button>
          </div>
          <ProfileRecordLoader person={picked} institutionName={session.institution?.name} />
        </div>
      )}
    </section>
  );
}

// Connection cards carry a short summary; load the full (visibility-filtered) profile from the alumni search.
function ProfileRecordLoader({ person, institutionName }) {
  const [full, setFull] = useState(person.father !== undefined ? person : null);
  useEffect(() => {
    if (person.father !== undefined) return;
    api(`/api/me/alumni?q=${encodeURIComponent(person.name)}`)
      .then((data) => setFull((data.alumni || []).find((item) => item.id === person.id) || person))
      .catch(() => setFull(person));
  }, [person]);
  if (!full) return <p className="sub">…</p>;
  return <ProfileRecord member={full} institutionName={institutionName} />;
}
