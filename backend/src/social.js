import { col, getMemberById } from "./db.js";
import { listFor, markAllRead, notifyAllMembers, notifyMember } from "./notify.js";
import { HttpError, makeId, text, wrap } from "./util.js";

const clean = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

async function feedFor(instId, viewerId) {
  const posts = (await col("posts").find({ instId }).sort({ pinned: -1, createdAt: -1 }).limit(100).toArray()).map(clean);
  const comments = (await col("comments").find({ instId }).sort({ createdAt: 1 }).toArray()).map(clean);
  return posts.map((post) => ({
    ...post,
    likes: post.likes?.length || 0,
    liked: viewerId ? !!post.likes?.includes(viewerId) : false,
    isOwner: viewerId ? post.author.id === viewerId : false,
    comments: comments.filter((item) => item.postId === post.id).map((item) => ({ ...item, isOwner: viewerId ? item.author.id === viewerId : false })),
  }));
}

const authorOf = (member) => ({ kind: "member", id: member.id, name: member.name, photo: member.photo || "" });

export function mountSocial(app, { admin, memberOnly }) {
  // ---------- notifications ----------
  const bell = (kind, idOf) => async (req, res) => {
    const list = await listFor(kind, idOf(req));
    res.json({ notifications: list, unread: list.filter((item) => !item.read).length, emailAlerts: kind === "admin" ? true : req.member.emailAlerts !== false });
  };
  app.get("/api/me/notifications", memberOnly, wrap(bell("member", (req) => req.member.id)));
  app.post("/api/me/notifications/read", memberOnly, wrap(async (req, res) => {
    await markAllRead("member", req.member.id);
    res.json({ ok: true });
  }));
  app.patch("/api/me/email-alerts", memberOnly, wrap(async (req, res) => {
    await col("members").updateOne({ id: req.member.id }, { $set: { emailAlerts: !!req.body?.on } });
    res.json({ ok: true });
  }));
  app.get("/api/notifications", admin, wrap(bell("admin", (req) => req.inst.id)));
  app.post("/api/notifications/read", admin, wrap(async (req, res) => {
    await markAllRead("admin", req.inst.id);
    res.json({ ok: true });
  }));

  // ---------- feed ----------
  app.get("/api/me/feed", memberOnly, wrap(async (req, res) => {
    res.json({ posts: await feedFor(req.member.instId, req.member.id) });
  }));
  app.get("/api/feed", admin, wrap(async (req, res) => {
    res.json({ posts: await feedFor(req.inst.id, null) });
  }));

  app.post("/api/me/posts", memberOnly, wrap(async (req, res) => {
    const body = text(req.body?.body, 2000);
    if (!body) throw new HttpError(400, "Write something to post.");
    await col("posts").insertOne({
      id: makeId(), instId: req.member.instId, author: authorOf(req.member), body, pinned: false, likes: [], createdAt: Date.now(),
    });
    res.status(201).json({ ok: true });
  }));

  app.post("/api/posts", admin, wrap(async (req, res) => {
    const body = text(req.body?.body, 2000);
    if (!body) throw new HttpError(400, "Write something to post.");
    await col("posts").insertOne({
      id: makeId(), instId: req.inst.id, author: { kind: "admin", id: req.inst.id, name: req.inst.name, photo: "" },
      body, pinned: true, likes: [], createdAt: Date.now(),
    });
    notifyAllMembers(req.inst.id, null, { type: "announcement", text: `${req.inst.name} posted an announcement`, view: "feed" });
    res.status(201).json({ ok: true });
  }));

  const postOf = async (id, instId) => {
    const post = clean(await col("posts").findOne({ id }));
    if (!post || post.instId !== instId) throw new HttpError(404, "That post was not found.");
    return post;
  };

  const removePost = async (post) => {
    await col("posts").deleteOne({ id: post.id });
    await col("comments").deleteMany({ postId: post.id });
  };

  app.delete("/api/me/posts/:id", memberOnly, wrap(async (req, res) => {
    const post = await postOf(req.params.id, req.member.instId);
    if (post.author.id !== req.member.id) throw new HttpError(403, "You can only delete your own posts.");
    await removePost(post);
    res.json({ ok: true });
  }));
  app.delete("/api/posts/:id", admin, wrap(async (req, res) => {
    await removePost(await postOf(req.params.id, req.inst.id));
    res.json({ ok: true });
  }));

  app.post("/api/me/posts/:id/like", memberOnly, wrap(async (req, res) => {
    const post = await postOf(req.params.id, req.member.instId);
    const liked = post.likes?.includes(req.member.id);
    await col("posts").updateOne({ id: post.id }, liked ? { $pull: { likes: req.member.id } } : { $addToSet: { likes: req.member.id } });
    if (!liked && post.author.kind === "member" && post.author.id !== req.member.id) {
      notifyMember(await getMemberById(post.author.id), { type: "like", text: `${req.member.name} liked your post`, view: "feed" });
    }
    res.json({ ok: true });
  }));

  app.post("/api/me/posts/:id/comments", memberOnly, wrap(async (req, res) => {
    const post = await postOf(req.params.id, req.member.instId);
    const body = text(req.body?.body, 600);
    if (!body) throw new HttpError(400, "Write a comment first.");
    await col("comments").insertOne({
      id: makeId(), instId: post.instId, postId: post.id, author: authorOf(req.member), body, createdAt: Date.now(),
    });
    if (post.author.kind === "member" && post.author.id !== req.member.id) {
      notifyMember(await getMemberById(post.author.id), { type: "comment", text: `${req.member.name} commented on your post`, view: "feed" });
    }
    res.status(201).json({ ok: true });
  }));

  app.delete("/api/me/comments/:id", memberOnly, wrap(async (req, res) => {
    const done = await col("comments").deleteOne({ id: req.params.id, "author.id": req.member.id });
    if (!done.deletedCount) throw new HttpError(404, "That comment was not found.");
    res.json({ ok: true });
  }));
  app.delete("/api/comments/:id", admin, wrap(async (req, res) => {
    await col("comments").deleteOne({ id: req.params.id, instId: req.inst.id });
    res.json({ ok: true });
  }));

  // ---------- messages (between connected members) ----------
  const connected = async (a, b) => !!await col("connections").findOne({
    status: "accepted", $or: [{ from: a, to: b }, { from: b, to: a }],
  });

  app.get("/api/me/messages", memberOnly, wrap(async (req, res) => {
    const me = req.member.id;
    const links = await col("connections").find({ status: "accepted", $or: [{ from: me }, { to: me }] }).toArray();
    const out = [];
    for (const link of links) {
      const otherId = link.from === me ? link.to : link.from;
      const row = await getMemberById(otherId);
      if (!row) continue;
      const last = clean(await col("messages").find({ $or: [{ from: me, to: otherId }, { from: otherId, to: me }] }).sort({ createdAt: -1 }).limit(1).next());
      const unread = await col("messages").countDocuments({ from: otherId, to: me, read: false });
      out.push({
        member: { id: row.id, name: row.name, photo: row.photo || "" },
        last: last ? { body: last.body, createdAt: last.createdAt, mine: last.from === me } : null,
        unread,
      });
    }
    out.sort((a, b) => (b.last?.createdAt || 0) - (a.last?.createdAt || 0));
    res.json({ conversations: out, unread: out.reduce((sum, item) => sum + item.unread, 0) });
  }));

  app.get("/api/me/messages/:id", memberOnly, wrap(async (req, res) => {
    const me = req.member.id;
    const other = req.params.id;
    if (!await connected(me, other)) throw new HttpError(403, "Connect with this person to chat.");
    await col("messages").updateMany({ from: other, to: me, read: false }, { $set: { read: true } });
    const rows = await col("messages").find({ $or: [{ from: me, to: other }, { from: other, to: me }] }).sort({ createdAt: 1 }).limit(300).toArray();
    res.json({ messages: rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt, mine: row.from === me })) });
  }));

  app.post("/api/me/messages/:id", memberOnly, wrap(async (req, res) => {
    const me = req.member;
    const other = await getMemberById(req.params.id);
    const body = text(req.body?.body, 1500);
    if (!other || !await connected(me.id, other.id)) throw new HttpError(403, "Connect with this person to chat.");
    if (!body) throw new HttpError(400, "Type a message.");
    await col("messages").insertOne({ id: makeId(), instId: me.instId, from: me.id, to: other.id, body, read: false, createdAt: Date.now() });
    // one unread message notification per sender is enough
    const pending = await col("notifications").findOne({ kind: "member", userId: other.id, type: "message", read: false, text: `New message from ${me.name}` });
    if (!pending) notifyMember(other, { type: "message", text: `New message from ${me.name}`, view: "messages" });
    res.status(201).json({ ok: true });
  }));
}
