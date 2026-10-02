import "./env.js";
import { v2 as cloudinary } from "cloudinary";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { HttpError } from "./util.js";

const FOLDER = "pupilsweb/profiles";

function configured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function client() {
  if (!configured()) {
    throw new HttpError(500, "Photo upload is not configured. Add the Cloudinary keys to the server environment.");
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export function uploadProfilePhoto(buffer) {
  const api = client();
  const publicId = `${FOLDER}/${crypto.randomUUID()}`;
  return new Promise((resolve, reject) => {
    const stream = api.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 800, height: 800, crop: "limit" }],
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(new HttpError(502, "Could not store the profile picture. Try again."));
          return;
        }
        resolve({ photo: result.secure_url, photoId: result.public_id });
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

export async function removePhoto(photoId) {
  if (!photoId || !configured()) return;
  try {
    await client().uploader.destroy(photoId, { resource_type: "image" });
  } catch (error) {
    console.error("Could not delete Cloudinary photo", error);
  }
}

export function acceptPhoto(photo, photoId) {
  const urlText = String(photo ?? "").trim();
  const id = String(photoId ?? "").trim();
  if (!urlText && !id) return { photo: "", photoId: "" };
  if (!/^pupilsweb\/profiles\/[A-Za-z0-9-]+$/.test(id)) {
    throw new HttpError(400, "Upload the profile picture again.");
  }
  let url;
  try {
    url = new URL(urlText);
  } catch {
    throw new HttpError(400, "Upload the profile picture again.");
  }
  const path = decodeURIComponent(url.pathname);
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    !cloud ||
    !path.startsWith(`/${cloud}/`) ||
    !path.includes(`/${id}`)
  ) {
    throw new HttpError(400, "Upload the profile picture again.");
  }
  return { photo: url.toString(), photoId: id };
}
