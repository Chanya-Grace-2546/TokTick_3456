import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

// Lab 2 Issue 6 — Attachment upload
// BR-22: JPG/JPEG, PNG, WEBP, PDF only, 5MB max per file.
// BR-24: original filename kept only as display metadata; the file on
// disk uses a generated, collision-safe name.

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Fresh clone / first run won't have this directory yet — multer's
// diskStorage does not create it automatically and will error otherwise.
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, safeName);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("INVALID_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});
