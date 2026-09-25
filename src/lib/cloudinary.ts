import crypto from "node:crypto";

// Signed uploads straight to Cloudinary's REST API (no SDK dependency).
// Credentials are read lazily so the app can boot before they're set —
// uploads just fail with a clear message until CLOUDINARY_* env vars exist.
function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured(): boolean {
  return getConfig() !== null;
}

function requireConfig() {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Cloudinary isn't configured yet. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the environment."
    );
  }
  return config;
}

function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where scripts/migrate-media-to-cloudinary.ts put the image that used to be
 * the `media` row `id` (public_id = infraguru/media/<id>). Null when Cloudinary
 * isn't configured or `id` isn't a media id. */
export function migratedMediaUrl(id: string): string | null {
  const config = getConfig();
  if (!config || !UUID_RE.test(id)) return null;
  return `https://res.cloudinary.com/${config.cloudName}/image/upload/infraguru/media/${id.toLowerCase()}`;
}

export async function uploadToCloudinary(
  data: Buffer,
  filename: string,
  resourceType: "image" | "video",
  options: { folder?: string } = {}
): Promise<{ url: string; publicId: string }> {
  const config = requireConfig();

  const timestamp = Math.round(Date.now() / 1000);
  const folder = options.folder ?? "infraguru/gallery";
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + config.apiSecret)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)]), filename);
  form.append("api_key", config.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`Cloudinary upload failed: ${message}`);
  }

  const json = (await res.json()) as { secure_url: string; public_id: string };
  return { url: json.secure_url, publicId: json.public_id };
}

/* ── Private files (job-application resumes) ──────────────────────────────
 * Stored as raw, type=authenticated assets: Cloudinary refuses to serve them
 * without a URL signed with our API secret, so a resume is never reachable by
 * a plain link. The admin-only route downloads it server-side and streams it. */

const RESUME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export function resumePublicId(baseId: string, mimeType: string): string {
  return `infraguru/resumes/${baseId}${RESUME_EXTENSIONS[mimeType] ?? ""}`;
}

export async function uploadPrivateFile(
  data: Buffer,
  publicId: string,
  filename: string,
  mimeType: string
): Promise<void> {
  const config = requireConfig();
  const params = {
    public_id: publicId,
    timestamp: String(Math.round(Date.now() / 1000)),
    type: "authenticated",
  };

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: mimeType }), filename);
  form.append("api_key", config.apiKey);
  form.append("signature", signParams(params, config.apiSecret));
  for (const [k, v] of Object.entries(params)) form.append(k, v);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`Cloudinary upload failed: ${message}`);
  }
}

/** The file's bytes, or null when it doesn't exist. */
export async function fetchPrivateFile(publicId: string): Promise<Buffer | null> {
  const config = requireConfig();
  // Delivery signature: first 8 chars of the URL-safe base64 SHA-1 of `<public_id><secret>`.
  const signature = crypto
    .createHash("sha1")
    .update(publicId + config.apiSecret)
    .digest("base64url")
    .slice(0, 8);
  const res = await fetch(
    `https://res.cloudinary.com/${config.cloudName}/raw/authenticated/s--${signature}--/${publicId}`,
    { cache: "no-store" }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloudinary download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deletePrivateFile(publicId: string): Promise<void> {
  const config = requireConfig();
  const params = {
    public_id: publicId,
    timestamp: String(Math.round(Date.now() / 1000)),
    type: "authenticated",
  };

  const form = new FormData();
  form.append("api_key", config.apiKey);
  form.append("signature", signParams(params, config.apiSecret));
  for (const [k, v] of Object.entries(params)) form.append(k, v);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/raw/destroy`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`Cloudinary delete failed: ${message}`);
  }
}
