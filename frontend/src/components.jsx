import { useEffect, useId, useState } from "react";

export const initials = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

export const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const safeUrl = (url) => (/^https?:\/\//i.test(url || "") ? url : `https://${url || ""}`);

const ICONS = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  batches: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8-1 3.9 15.4-3.8 1z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2",
  members: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
  chevron: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
};

export function Icon({ name, size = 20 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">A</div>
      Alumni Connect
    </div>
  );
}

export function ErrBox({ msg }) {
  if (!msg) return null;
  return <div className="err" role="alert">{msg}</div>;
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function PasswordField({ label, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder || "At least 6 characters"}
          value={value}
          onChange={onChange}
        />
        <button type="button" onClick={() => setShow((open) => !open)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Brand />
        <div>
          <p className="eyebrow light">The yearbook, online</p>
          <div className="years" aria-hidden="true">
            <span>2001</span>
            <span className="on">2003</span>
            <span>2004</span>
            <span>2010</span>
          </div>
          <p>Bring every batch back together. Create your school or college, add the years, and share one link.</p>
        </div>
        <p className="art-foot">Schools · Colleges · Batches</p>
      </aside>
      <div className="auth-form">
        <div className="panel">{children}</div>
      </div>
    </div>
  );
}

export function OtpInputs({ value, onChange }) {
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const setAt = (index, digit) => {
    onChange((current) => {
      const next = String(current || "").padEnd(6, " ").split("");
      next[index] = digit || " ";
      return next.join("").replace(/\s+$/g, "");
    });
  };
  return (
    <div className="otp">
      {digits.map((digit, index) => (
        <input
          key={index}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          maxLength={1}
          value={digit.trim()}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(-1);
            setAt(index, next);
            if (next) event.target.nextElementSibling?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit.trim()) event.target.previousElementSibling?.focus();
          }}
          onPaste={(event) => {
            const pasted = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
            if (!pasted) return;
            event.preventDefault();
            onChange(pasted);
          }}
        />
      ))}
    </div>
  );
}

export function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="scrim" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title || "Details"}>
        <div className="drawer-top">
          <span className="grab" aria-hidden="true" />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function KV({ rows }) {
  const filled = rows.filter(([, value]) => value);
  if (!filled.length) return null;
  return (
    <dl className="kv">
      {filled.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MemberProfile({ member }) {
  return (
    <>
      <div className="d-top">
        <div className="av lg">{initials(member.name)}</div>
        <div>
          <h2>{member.name}</h2>
          <span className="tag">Batch {member.batch}</span>
          <small>Joined {fmtDate(member.joinedAt)}</small>
        </div>
      </div>
      <section className="d-sec">
        <h3>Contact</h3>
        <KV rows={[["Mobile", member.mobile], ["Email", member.email], ["Date of birth", member.dob], ["Gender", member.gender], ["Blood group", member.blood]]} />
      </section>
      <section className="d-sec">
        <h3>Family</h3>
        <KV rows={[["Father", member.father], ["Mother", member.mother]]} />
      </section>
      <section className="d-sec">
        <h3>Address</h3>
        <KV rows={[["Current address", member.curAddr], ["City", member.city], ["Native address", member.nativeAddr]]} />
      </section>
      <section className="d-sec">
        <h3>Education</h3>
        <KV rows={[["Qualification", member.qualification], ["Occupation", member.occupation]]} />
        {(member.schools || []).map((school, index) => (
          <div className="mini" key={`s${index}`}>
            <b>{school.name}</b>
            <small>{["School", school.board, [school.from, school.to].filter(Boolean).join("–")].filter(Boolean).join(" · ")}</small>
          </div>
        ))}
        {(member.colleges || []).map((college, index) => (
          <div className="mini" key={`c${index}`}>
            <b>{college.name}</b>
            <small>{[college.degree || "College", college.from || college.to ? `${college.from}–${college.to}` : ""].filter(Boolean).join(" · ")}</small>
          </div>
        ))}
      </section>
      {!!member.businesses?.length && (
        <section className="d-sec">
          <h3>Business</h3>
          {member.businesses.map((business, index) => (
            <div className="mini" key={index}>
              <b>{business.name}</b>
              {business.industry && <small> · {business.industry}</small>}
              <small>{[business.role, business.city, business.phone].filter(Boolean).join(" · ")}</small>
              {business.desc && <p>{business.desc}</p>}
              {business.web && <a href={safeUrl(business.web)} target="_blank" rel="noreferrer">{business.web}</a>}
            </div>
          ))}
        </section>
      )}
      {!!member.links?.length && (
        <section className="d-sec">
          <h3>Links</h3>
          {member.links.map((link, index) => (
            <div className="mini" key={index}>
              <small>{link.label || "Link"}</small>
              <a href={safeUrl(link.url)} target="_blank" rel="noreferrer">{link.url}</a>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

export function Loading({ label = "Opening your yearbook…" }) {
  return (
    <div className="loading">
      <div className="brand-mark">A</div>
      <p>{label}</p>
    </div>
  );
}
