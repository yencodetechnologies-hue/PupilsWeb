import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Brand, ErrBox, Field, MemberProfile, initials } from "../components";
import { useAuth, useToast } from "../state";

export function MemberHome() {
  const { session, setSession, updateMember } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const member = session.member;
  const inst = session.institution;
  const [mates, setMates] = useState([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api("/api/me/batchmates")
      .then((data) => setMates(data.batchmates))
      .catch(() => setMates([]));
  }, []);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    navigate("/");
  };

  return (
    <div className="join-wrap member-home">
      <header className="join-hero">
        <Brand />
        <p className="eyebrow light">{inst?.type || "Alumni"}</p>
        <h1>{inst?.name || "Your institution"}</h1>
        <p>Batch {member.batch} · {mates.length} batchmate{mates.length === 1 ? "" : "s"} here</p>
      </header>
      <div className="join-body stack">
        <section className="card profile-card">
          <div className="sec-h">
            <h2>Your profile</h2>
            <button className="btn ghost sm" onClick={() => setEditing((open) => !open)}>{editing ? "Close" : "Edit profile"}</button>
          </div>
          {editing ? (
            <EditProfile member={member} onSaved={(next) => { updateMember(next); setEditing(false); toast("Profile saved"); }} />
          ) : (
            <MemberProfile member={member} />
          )}
        </section>
        <section className="card">
          <h2>Your batchmates</h2>
          {mates.length ? (
            <div className="mate-grid">
              {mates.map((mate) => (
                <article className="mate" key={mate.id}>
                  <div className="av">{initials(mate.name)}</div>
                  <b>{mate.name}</b>
                  <small>{[mate.city, mate.occupation || mate.qualification].filter(Boolean).join(" · ") || "Batchmate"}</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No one else from your batch yet. Share the join link with your classmates.</p>
          )}
        </section>
        <button className="btn ghost" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}

function EditProfile({ member, onSaved }) {
  const [mobile, setMobile] = useState(member.mobile || "");
  const [city, setCity] = useState(member.city || "");
  const [occupation, setOccupation] = useState(member.occupation || "");
  const [links, setLinks] = useState(member.links?.length ? member.links : [{ label: "", url: "" }]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/me", {
        method: "PATCH",
        body: { mobile, city, occupation, links },
      });
      onSaved(data.member);
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <ErrBox msg={err} />
      <p className="sub">Update how batchmates can reach you. Email stays {member.email}.</p>
      <div className="row">
        <Field label="Mobile number"><input inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} /></Field>
        <Field label="City"><input value={city} onChange={(event) => setCity(event.target.value)} /></Field>
      </div>
      <Field label="Occupation"><input value={occupation} onChange={(event) => setOccupation(event.target.value)} /></Field>
      <div className="repeater">
        <div className="sec-h">
          <h3>Links</h3>
          <button type="button" className="btn ghost sm" onClick={() => setLinks([...links, { label: "", url: "" }])}>Add link</button>
        </div>
        {links.map((link, index) => (
          <div className="row" key={index}>
            <Field label="Label">
              <input placeholder="LinkedIn" value={link.label} onChange={(event) => setLinks(links.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} />
            </Field>
            <Field label="URL">
              <input placeholder="linkedin.com/in/you" value={link.url} onChange={(event) => setLinks(links.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} />
            </Field>
          </div>
        ))}
      </div>
      <button className="btn brass" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
