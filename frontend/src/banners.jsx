import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { ErrBox, Field } from "./components";
import { useI18n } from "./i18n";
import { apiUrl } from "./site";
import { useToast } from "./state";

const safeLink = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/* ---------- member side: auto-scrolling carousel ---------- */
export function BannerCarousel() {
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);
  const track = useRef(null);

  useEffect(() => {
    api("/api/me/banners").then((data) => setBanners(data.banners)).catch(() => setBanners([]));
  }, []);

  const go = (next) => {
    const el = track.current;
    if (!el || !banners.length) return;
    const target = (next + banners.length) % banners.length;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setIndex(target);
  };

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const handle = setInterval(() => {
      if (!paused.current && !document.hidden) go(index + 1);
    }, 4000);
    return () => clearInterval(handle);
  });

  if (!banners.length) return null;

  return (
    <div
      className="banner-carousel no-print"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onTouchStart={() => { paused.current = true; }}
      onTouchEnd={() => { setTimeout(() => { paused.current = false; }, 4000); }}
    >
      <div
        className="banner-track"
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {banners.map((banner) => {
          const img = <img src={banner.image} alt={banner.title || ""} loading="lazy" draggable="false" />;
          return (
            <div className="banner-slide" key={banner.id}>
              {banner.link ? <a href={safeLink(banner.link)} target="_blank" rel="noreferrer">{img}</a> : img}
              {banner.title && <span className="banner-title">{banner.title}</span>}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <>
          <button type="button" className="banner-nav prev" aria-label="Previous" onClick={() => go(index - 1)}>‹</button>
          <button type="button" className="banner-nav next" aria-label="Next" onClick={() => go(index + 1)}>›</button>
          <div className="banner-dots">
            {banners.map((banner, position) => (
              <button type="button" key={banner.id} className={position === index ? "on" : ""} aria-label={`Banner ${position + 1}`} onClick={() => go(position)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- admin side: upload, list, toggle ---------- */
export function AdminBanners() {
  const { t } = useI18n();
  const toast = useToast();
  const [banners, setBanners] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const load = () => api("/api/banners").then((data) => setBanners(data.banners)).catch((error) => setErr(error.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!file) { setPreview(""); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) return setErr(t("bannerType"));
    if (next.size > 3 * 1024 * 1024) return setErr(t("bannerSize"));
    setErr("");
    setFile(next);
  };

  const upload = async () => {
    if (!file) return setErr(t("bannerChoose"));
    setBusy(true);
    setErr("");
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("title", title);
      body.append("link", link);
      const res = await fetch(apiUrl("/api/banners"), { method: "POST", credentials: "include", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      toast(t("bannerUploaded"));
      setFile(null); setTitle(""); setLink("");
      if (input.current) input.current.value = "";
      load();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (banner) => {
    setBanners((list) => list.map((item) => (item.id === banner.id ? { ...item, active: !item.active } : item)));
    try {
      await api(`/api/banners/${banner.id}`, { method: "PATCH", body: { active: !banner.active } });
    } catch (error) {
      toast(error.message, "err");
      load();
    }
  };

  const remove = async (banner) => {
    if (!window.confirm(t("confirmBanner"))) return;
    try {
      await api(`/api/banners/${banner.id}`, { method: "DELETE" });
      toast(t("bannerRemoved"));
      load();
    } catch (error) {
      toast(error.message, "err");
    }
  };

  const live = (banners || []).filter((item) => item.active).length;

  return (
    <section className="card banner-admin">
      <div className="shelf-head">
        <h2>{t("banners")}</h2>
        <span className="count-pill">{t("bannersLive", { n: live })}</span>
      </div>
      <p className="sub">{t("bannersHint")}</p>
      <ErrBox msg={err} />
      <div className="banner-upload">
        <label className={`banner-drop ${preview ? "has" : ""}`}>
          {preview ? <img src={preview} alt="" /> : <span>＋ {t("bannerChoose")}<small>{t("bannerRule")}</small></span>}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} hidden />
        </label>
        <div className="banner-fields">
          <Field label={t("bannerTitle")}><input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label={t("eventLink")}><input value={link} placeholder="https://" onChange={(event) => setLink(event.target.value)} /></Field>
          <button type="button" className="btn brass" disabled={busy || !file} onClick={upload}>{busy ? t("saving") : t("uploadBanner")}</button>
        </div>
      </div>
      <div className="banner-rows">
        {banners && !banners.length && <p className="muted">{t("noBanners")}</p>}
        {(banners || []).map((banner) => (
          <div className={`banner-row ${banner.active ? "" : "off"}`} key={banner.id}>
            <img src={banner.image} alt="" />
            <div className="banner-meta">
              <b>{banner.title || t("untitledBanner")}</b>
              <small>{banner.link || t("noLink")}</small>
            </div>
            <label className="switch" title={banner.active ? t("bannerOn") : t("bannerOff")}>
              <input type="checkbox" checked={banner.active} onChange={() => toggle(banner)} />
              <span />
              <em>{banner.active ? t("bannerOn") : t("bannerOff")}</em>
            </label>
            <button type="button" className="btn danger sm" onClick={() => remove(banner)}>{t("remove")}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
