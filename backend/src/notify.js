import { col } from "./db.js";
import { sendMail } from "./mail.js";
import { makeId } from "./util.js";

const clean = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

// Records an in-app notification and, if the recipient allows it, emails the same text.
// Never throws: a failed notification must not break the action that triggered it.
export async function notify({ instId, kind, userId, type, text, view, email }) {
  try {
    await col("notifications").insertOne({
      id: makeId(), instId, kind, userId, type, text, view: view || "", read: false, createdAt: Date.now(),
    });
    if (email) {
      const to = kind === "admin" ? email : email.address;
      if (to && (kind === "admin" || email.allowed)) {
        sendMail(to, "PupilsWeb: " + text, `${text}\n\nOpen PupilsWeb to see it.`).catch(() => {});
      }
    }
  } catch (error) {
    console.error("notify failed:", error.message);
  }
}

const emailOf = (row) => ({ address: row.email, allowed: row.emailAlerts !== false });

export async function notifyMember(memberRow, { type, text, view }) {
  if (!memberRow) return;
  await notify({ instId: memberRow.instId, kind: "member", userId: memberRow.id, type, text, view, email: emailOf(memberRow) });
}

export async function notifyAdmin(inst, { type, text, view }) {
  if (!inst) return;
  await notify({ instId: inst.id, kind: "admin", userId: inst.id, type, text, view, email: inst.adminEmail });
}

// Everyone in an institution except `exceptId`.
export async function notifyAllMembers(instId, exceptId, { type, text, view }) {
  const rows = await col("members").find({ instId, id: { $ne: exceptId } }).toArray();
  for (const row of rows) await notifyMember(clean(row), { type, text, view });
}

export async function listFor(kind, userId) {
  const rows = await col("notifications").find({ kind, userId }).sort({ createdAt: -1 }).limit(40).toArray();
  return rows.map(clean);
}

export async function markAllRead(kind, userId) {
  await col("notifications").updateMany({ kind, userId, read: false }, { $set: { read: true } });
}
