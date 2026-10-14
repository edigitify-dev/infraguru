import "server-only";
import { db, getPool } from "./client";
import { saveSection } from "./pageContent";
import { defaultReviewSettings, parseReviewSettings, type ReviewSettings } from "../reviewSelection";

// Each business has its own selections, so changing Place ID cannot reuse
// another business's hidden/selected review IDs or manual entries.
function placeKey(): string {
  return process.env.GOOGLE_PLACE_ID?.trim() || "manual";
}

export async function getReviewSettings(options?: { strict?: boolean }): Promise<ReviewSettings | null> {
  if (options?.strict && !getPool()) throw new Error("Configure DATABASE_URL before managing reviews.");
  const sql = "select content from page_sections where page_slug = $1 and section_key = $2";
  const params = ["google-reviews", placeKey()];
  const result = options?.strict
    ? await db.query<{ content: unknown }>(sql, params)
    : await db.read<{ content: unknown }>(sql, params, { stale: false });
  // If we cannot load moderation settings, hide the section rather than
  // accidentally showing reviews the admin previously removed.
  if ("source" in result && result.source === "none") return null;
  const content = result.rows[0]?.content;
  if (content == null) return defaultReviewSettings();
  try {
    return parseReviewSettings(content);
  } catch (error) {
    if (options?.strict) throw error;
    console.error("[reviews] Could not read review selections.");
    return null;
  }
}

export async function saveReviewSettings(settings: ReviewSettings): Promise<void> {
  // db.query otherwise returns an empty result if DATABASE_URL is absent.
  // An editor must never see a successful save without persistence.
  if (!getPool()) throw new Error("Configure DATABASE_URL before managing reviews.");
  await saveSection("google-reviews", placeKey(), settings);
}
