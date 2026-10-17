import multer from "multer";
import { col } from "./db.js";
import { removePhoto, uploadBanner } from "./media.js";
import { HttpError, makeId, text, wrap } from "./util.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Use a JPG, PNG, or WebP image."));
  },
});

const clean = (doc) => {
  if (!doc) return null;
  const { _id, imageId, ...rest } = doc;
  return rest;
};

const banners = () => col("banners");

export function mountBanners(app, { admin, memberOnly }) {
  app.get("/api/banners", admin, wrap(async (req, res) => {
    const rows = await banners().find({ instId: req.inst.id }).sort({ createdAt: -1 }).toArray();
    res.json({ banners: rows.map(clean) });
  }));

  app.post("/api/banners", admin, (req, res, next) => {
    upload.single("image")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") return next(new HttpError(400, "Banner must be 3 MB or smaller."));
      return next(error);
    });
  }, wrap(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Choose a banner image.");
    const uploaded = await uploadBanner(req.file.buffer);
    await banners().insertOne({
      id: makeId(), instId: req.inst.id, ...uploaded,
      title: text(req.body?.title, 100), link: text(req.body?.link, 300),
      active: true, createdAt: Date.now(),
    });
    res.status(201).json({ ok: true });
  }));

  app.patch("/api/banners/:id", admin, wrap(async (req, res) => {
    const fields = {};
    if (req.body?.active !== undefined) fields.active = !!req.body.active;
    if (req.body?.title !== undefined) fields.title = text(req.body.title, 100);
    if (req.body?.link !== undefined) fields.link = text(req.body.link, 300);
    const done = await banners().updateOne({ id: req.params.id, instId: req.inst.id }, { $set: fields });
    if (!done.matchedCount) throw new HttpError(404, "That banner was not found.");
    res.json({ ok: true });
  }));

  app.delete("/api/banners/:id", admin, wrap(async (req, res) => {
    const row = await banners().findOne({ id: req.params.id, instId: req.inst.id });
    if (!row) throw new HttpError(404, "That banner was not found.");
    await banners().deleteOne({ id: row.id });
    await removePhoto(row.imageId);
    res.json({ ok: true });
  }));

  app.get("/api/me/banners", memberOnly, wrap(async (req, res) => {
    const rows = await banners().find({ instId: req.member.instId, active: true }).sort({ createdAt: -1 }).toArray();
    res.json({ banners: rows.map(clean) });
  }));
}
