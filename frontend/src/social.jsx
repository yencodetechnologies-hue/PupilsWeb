import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Avatar, ErrBox, Icon } from "./components";
import { useI18n } from "./i18n";
import { useToast } from "./state";

function ago(ts, lang) {
  const mins = Math.floor((Date.now() - ts) / 6e4);
  if (mins < 1) return lang === "ta" ? "இப்போது" : "now";
  if (mins < 60) return `${mins}${lang === "ta" ? " நிமி" : "m"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${lang === "ta" ? " மணி" : "h"}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}${lang === "ta" ? " நாள்" : "d"}`;
  return new Date(ts).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short" });
}

function usePolling(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    ref.current();
    const handle = setInterval(() => { if (!document.hidden) ref.current(); }, ms);
    return () => clearInterval(handle);
  }, [ms]);
}

/* ---------------- Notifications bell ---------------- */
export function Bell({ isAdmin, onOpen }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const base = isAdmin ? "/api/notifications" : "/api/me/notifications";
  const [data, setData] = useState({ notifications: [], unread: 0, emailAlerts: true });
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api(base).then(setData).catch(() => {});
  }, [base]);
  usePolling(load, 20000);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && data.unread) {
      await api(`${base}/read`, { method: "POST" }).catch(() => {});
      setData((current) => ({ ...current, unread: 0 }));
      setTimeout(load, 1500);
    }
  };

  const setEmail = async () => {
    try {
      await api("/api/me/email-alerts", { method: "PATCH", body: { on: !data.emailAlerts } });
      setData((current) => ({ ...current, emailAlerts: !current.emailAlerts }));
    } catch (error) {
      toast(error.message, "err");
    }
  };

  return (
    <div className="bell-wrap">
      <button type="button" className="bell-btn" aria-label={t("notifications")} onClick={toggle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0" />
        </svg>
        {data.unread > 0 && <i className="bell-dot">{data.unread > 9 ? "9+" : data.unread}</i>}
      </button>
      {open && (
        <>
          <button type="button" className="bell-scrim" aria-label={t("close")} onClick={() => setOpen(false)} />
          <div className="bell-panel">
            <div className="bell-head"><b>{t("notifications")}</b></div>
            <div className="bell-list">
              {data.notifications.length ? data.notifications.map((item) => (
                <button type="button" key={item.id} className={`bell-item ${item.read ? "" : "new"}`}
                  onClick={() => { setOpen(false); if (item.view) onOpen?.(item.view); }}>
                  <span>{item.text}</span>
                  <small>{ago(item.createdAt, lang)}</small>
                </button>
              )) : <p className="bell-empty">{t("noNotifications")}</p>}
            </div>
            {!isAdmin && (
              <label className="bell-foot">
                <input type="checkbox" checked={data.emailAlerts} onChange={setEmail} />
                {t("emailAlerts")}
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Feed ---------------- */
function PostCard({ post, isAdmin, reload }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");

  const run = async (fn) => {
    try { await fn(); reload(); } catch (error) { toast(error.message, "err"); }
  };
  const canDelete = isAdmin || post.isOwner;
  const postBase = isAdmin ? "/api/posts" : "/api/me/posts";

  return (
    <article className={`post ${post.pinned ? "pinned" : ""}`}>
      <header className="post-head">
        {post.author.kind === "admin" ? <div className="av admin-av">★</div> : <Avatar name={post.author.name} photo={post.author.photo} />}
        <div>
          <b>{post.author.name}</b>
          <small>{post.author.kind === "admin" ? t("announcement") : ""}{post.author.kind === "admin" ? " · " : ""}{ago(post.createdAt, lang)}</small>
        </div>
        {canDelete && (
          <button type="button" className="post-x" aria-label={t("remove")}
            onClick={() => window.confirm(t("confirmPost")) && run(() => api(`${postBase}/${post.id}`, { method: "DELETE" }))}>×</button>
        )}
      </header>
      <p className="post-body">{post.body}</p>
      <div className="post-bar">
        {isAdmin ? <span>👍 {post.likes}</span> : (
          <button type="button" className={post.liked ? "on" : ""} onClick={() => run(() => api(`/api/me/posts/${post.id}/like`, { method: "POST" }))}>
            👍 {post.likes} {t("like")}
          </button>
        )}
        <button type="button" onClick={() => setShowComments(!showComments)}>💬 {post.comments.length} {t("comments")}</button>
      </div>
      {showComments && (
        <div className="post-comments">
          {post.comments.map((item) => (
            <div className="cmt" key={item.id}>
              <Avatar name={item.author.name} photo={item.author.photo} />
              <div>
                <b>{item.author.name}</b> <small>{ago(item.createdAt, lang)}</small>
                <p>{item.body}</p>
              </div>
              {(isAdmin || item.isOwner) && (
                <button type="button" className="post-x" aria-label={t("remove")}
                  onClick={() => run(() => api(`${isAdmin ? "/api/comments" : "/api/me/comments"}/${item.id}`, { method: "DELETE" }))}>×</button>
              )}
            </div>
          ))}
          {!isAdmin && (
            <form className="cmt-form" onSubmit={(event) => {
              event.preventDefault();
              if (!comment.trim()) return;
              run(async () => { await api(`/api/me/posts/${post.id}/comments`, { method: "POST", body: { body: comment } }); setComment(""); });
            }}>
              <input value={comment} maxLength={600} placeholder={t("writeComment")} onChange={(event) => setComment(event.target.value)} />
              <button className="btn brass sm">{t("send")}</button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export function Feed({ isAdmin }) {
  const { t } = useI18n();
  const toast = useToast();
  const [posts, setPosts] = useState(null);
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const feedPath = isAdmin ? "/api/feed" : "/api/me/feed";

  const load = useCallback(() => {
    api(feedPath).then((data) => setPosts(data.posts)).catch((error) => setErr(error.message));
  }, [feedPath]);
  usePolling(load, 30000);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api(isAdmin ? "/api/posts" : "/api/me/posts", { method: "POST", body: { body } });
      setBody("");
      toast(t("postShared"));
      load();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {isAdmin && (
        <header className="head">
          <div>
            <p className="eyebrow">{t("feed")}</p>
            <h1>{t("communityFeed")}</h1>
            <p>{t("feedAdminHint")}</p>
          </div>
        </header>
      )}
      <section className={isAdmin ? "" : "card no-print"}>
        <form className="composer card" onSubmit={submit}>
          <textarea rows={3} maxLength={2000} value={body} placeholder={isAdmin ? t("announcePh") : t("sharePh")} onChange={(event) => setBody(event.target.value)} />
          <div className="composer-bar">
            <small>{body.length}/2000</small>
            <button className="btn brass sm" disabled={busy || !body.trim()}>{isAdmin ? t("postAnnouncement") : t("post")}</button>
          </div>
        </form>
        <ErrBox msg={err} />
        <div className="post-list">
          {!posts ? null : posts.length ? posts.map((post) => <PostCard key={post.id} post={post} isAdmin={isAdmin} reload={load} />)
            : <div className="ev-empty"><Icon name="members" size={30} /><p>{t("noPosts")}</p></div>}
        </div>
      </section>
    </>
  );
}

/* ---------------- Messages ---------------- */
export function Messages() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [convos, setConvos] = useState(null);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  const loadConvos = useCallback(() => {
    api("/api/me/messages").then((data) => setConvos(data.conversations)).catch(() => setConvos([]));
  }, []);
  usePolling(loadConvos, 10000);

  const loadThread = useCallback(() => {
    if (!active) return;
    api(`/api/me/messages/${active.id}`).then((data) => setThread(data.messages)).catch(() => {});
  }, [active]);
  usePolling(loadThread, 5000);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [thread.length, active]);

  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !active) return;
    try {
      await api(`/api/me/messages/${active.id}`, { method: "POST", body: { body: draft } });
      setDraft("");
      loadThread();
      loadConvos();
    } catch (error) {
      toast(error.message, "err");
    }
  };

  return (
    <section className="card no-print chat-card">
      <h2>{t("messages")}</h2>
      <div className={`chat ${active ? "open" : ""}`}>
        <aside className="chat-list">
          {convos && !convos.length && <p className="muted pad">{t("noChats")}</p>}
          {(convos || []).map((item) => (
            <button type="button" key={item.member.id} className={`chat-row ${active?.id === item.member.id ? "on" : ""}`}
              onClick={() => { setActive(item.member); setThread([]); }}>
              <Avatar name={item.member.name} photo={item.member.photo} />
              <span>
                <b>{item.member.name}</b>
                <small>{item.last ? `${item.last.mine ? t("you") + ": " : ""}${item.last.body}` : t("sayHello")}</small>
              </span>
              {item.unread > 0 && <i className="bell-dot static">{item.unread}</i>}
            </button>
          ))}
        </aside>
        <div className="chat-pane">
          {active ? (
            <>
              <div className="chat-top">
                <button type="button" className="chat-back" onClick={() => setActive(null)} aria-label={t("close")}>←</button>
                <Avatar name={active.name} photo={active.photo} /><b>{active.name}</b>
              </div>
              <div className="chat-thread">
                {thread.map((item) => (
                  <div key={item.id} className={`bubble ${item.mine ? "mine" : ""}`}>
                    {item.body}<small>{ago(item.createdAt, lang)}</small>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form className="chat-form" onSubmit={send}>
                <input value={draft} maxLength={1500} placeholder={t("typeMessage")} onChange={(event) => setDraft(event.target.value)} />
                <button className="btn brass sm" disabled={!draft.trim()}>{t("send")}</button>
              </form>
            </>
          ) : <p className="muted pad chat-hint">{t("pickChat")}</p>}
        </div>
      </div>
    </section>
  );
}
