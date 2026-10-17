import { useEffect, useState } from "react";
import { api } from "./api";
import { ErrBox, Field, Icon } from "./components";
import { useI18n } from "./i18n";
import { useToast } from "./state";

const statusOf = (event, now) => (now < event.startAt ? "upcoming" : now <= event.endAt ? "ongoing" : "past");

const toLocalInput = (ts) => {
  const date = new Date(ts);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function when(lang, ts) {
  return new Date(ts).toLocaleString(lang === "ta" ? "ta-IN" : "en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

function EventCard({ event, status, lang, t, onEdit, onRemove }) {
  const date = new Date(event.startAt);
  return (
    <article className={`ev-card ${status}`}>
      <div className="ev-date">
        <b>{date.getDate()}</b>
        <span>{date.toLocaleString(lang === "ta" ? "ta-IN" : "en-IN", { month: "short" })}</span>
      </div>
      <div className="ev-body">
        <div className="ev-top">
          <h3>{event.title}</h3>
          <span className={`ev-badge ${status}`}>{status === "ongoing" ? t("happeningNow") : t(status)}</span>
        </div>
        <p className="ev-meta">
          <span><Icon name="calendar" size={15} />{when(lang, event.startAt)} → {when(lang, event.endAt)}</span>
          {event.venue && <span><Icon name="pin" size={15} />{event.venue}</span>}
        </p>
        {event.description && <p className="ev-desc">{event.description}</p>}
        <div className="ev-actions">
          {event.link && <a className="btn ghost sm" href={/^https?:\/\//i.test(event.link) ? event.link : `https://${event.link}`} target="_blank" rel="noreferrer">{t("openLink")}</a>}
          {onEdit && <button type="button" className="btn ghost sm" onClick={() => onEdit(event)}>{t("editLabel")}</button>}
          {onRemove && <button type="button" className="btn danger sm" onClick={() => onRemove(event)}>{t("remove")}</button>}
        </div>
      </div>
    </article>
  );
}

function EventList({ events, onEdit, onRemove }) {
  const { t, lang } = useI18n();
  const now = Date.now();
  const withStatus = events.map((event) => [event, statusOf(event, now)]);
  const count = (key) => withStatus.filter(([, status]) => status === key).length;
  const [tab, setTab] = useState(count("ongoing") ? "ongoing" : count("upcoming") ? "upcoming" : "all");
  const shown = withStatus
    .filter(([, status]) => tab === "all" || status === tab)
    .sort((a, b) => (a[1] === "past" || b[1] === "past" ? b[0].startAt - a[0].startAt : a[0].startAt - b[0].startAt));

  return (
    <>
      <div className="ev-tabs" role="tablist">
        {["ongoing", "upcoming", "past", "all"].map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`${tab === key ? "on" : ""} ${key}`} onClick={() => setTab(key)}>
            {key === "ongoing" && <i className="live-dot" />}
            {t(key === "all" ? "all" : key)}
            <small>{key === "all" ? events.length : count(key)}</small>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="ev-list">
          {shown.map(([event, status]) => (
            <EventCard key={event.id} event={event} status={status} lang={lang} t={t} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </div>
      ) : (
        <div className="ev-empty"><Icon name="calendar" size={30} /><p>{t("noEvents")}</p></div>
      )}
    </>
  );
}

export function MemberEvents() {
  const { t } = useI18n();
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/me/events").then((data) => setEvents(data.events)).catch((error) => setErr(error.message));
  }, []);

  return (
    <section className="card no-print">
      <h2>{t("events")}</h2>
      <p className="sub">{t("eventsMemberHint")}</p>
      <ErrBox msg={err} />
      {events && <EventList events={events} />}
    </section>
  );
}

const blank = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  return { title: "", description: "", venue: "", link: "", start: toLocalInput(start.getTime() + 36e5), end: toLocalInput(start.getTime() + 36e5 * 3) };
};

export function AdminEvents() {
  const { t } = useI18n();
  const toast = useToast();
  const [events, setEvents] = useState(null);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const load = () => api("/api/events").then((data) => setEvents(data.events)).catch((error) => setErr(error.message));
  useEffect(() => { load(); }, []);

  const reset = () => { setForm(blank()); setEditing(null); setErr(""); };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api(editing ? `/api/events/${editing}` : "/api/events", {
        method: editing ? "PATCH" : "POST",
        body: {
          title: form.title, description: form.description, venue: form.venue, link: form.link,
          startAt: new Date(form.start).getTime(), endAt: new Date(form.end).getTime(),
        },
      });
      toast(t("eventSaved"));
      reset();
      load();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (event) => {
    setEditing(event.id);
    setForm({ title: event.title, description: event.description || "", venue: event.venue || "", link: event.link || "", start: toLocalInput(event.startAt), end: toLocalInput(event.endAt) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (event) => {
    if (!window.confirm(t("confirmEvent"))) return;
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      toast(t("eventRemoved"));
      load();
    } catch (error) {
      toast(error.message, "err");
    }
  };

  return (
    <>
      <header className="head">
        <div>
          <p className="eyebrow">{t("events")}</p>
          <h1>{editing ? t("editEvent") : t("postEvent")}</h1>
          <p>{t("eventsHint")}</p>
        </div>
      </header>
      <form className="card ev-form" onSubmit={submit} noValidate>
        <ErrBox msg={err} />
        <Field label={t("eventTitle")}><input value={form.title} onChange={set("title")} maxLength={120} /></Field>
        <div className="row">
          <Field label={t("startsAt")}><input type="datetime-local" value={form.start} onChange={set("start")} /></Field>
          <Field label={t("endsAt")}><input type="datetime-local" value={form.end} onChange={set("end")} /></Field>
        </div>
        <div className="row">
          <Field label={t("eventVenue")}><input value={form.venue} onChange={set("venue")} maxLength={160} /></Field>
          <Field label={t("eventLink")}><input value={form.link} onChange={set("link")} placeholder="https://" /></Field>
        </div>
        <Field label={t("eventDesc")}><textarea rows={3} value={form.description} onChange={set("description")} maxLength={1500} /></Field>
        <div className="wizard-actions">
          {editing && <button type="button" className="btn ghost" onClick={reset}>{t("cancelEdit")}</button>}
          <button className="btn brass" disabled={busy}>{busy ? t("saving") : editing ? t("saveEvent") : t("postEvent")}</button>
        </div>
      </form>
      <section className="card">
        <h2>{t("events")}</h2>
        {!events ? null : events.length ? <EventList events={events} onEdit={edit} onRemove={remove} /> : (
          <div className="ev-empty"><Icon name="calendar" size={30} /><p>{t("noEventsAdmin")}</p></div>
        )}
      </section>
    </>
  );
}
