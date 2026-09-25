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
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Cloudinary isn't configured yet. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the environment."
    );
  }

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
