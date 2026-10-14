"use server";

import { requireAdmin } from "@/lib/auth";
import { parseReviewSettings } from "@/lib/reviewSelection";
import { saveReviewSettings } from "@/lib/db/reviews";
import { updateTag } from "next/cache";
import { getGoogleReviews, isGoogleReviewsConfigured } from "@/lib/googleReviews";

export async function refreshGoogleReviewsAction(): Promise<{ error?: string; refreshedAt?: string }> {
  await requireAdmin();
  if (!isGoogleReviewsConfigured()) return { error: "Configure Google credentials before refreshing reviews." };
  updateTag("google-reviews");
  const reviews = await getGoogleReviews();
  if (!reviews) return { error: "Google reviews could not be refreshed. Please try again." };
  return { refreshedAt: reviews.fetchedAt };
}

export async function saveReviewsAction(value: unknown): Promise<{ error?: string; success?: boolean }> {
  await requireAdmin();
  let settings;
  try {
    settings = parseReviewSettings(value);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid review settings." };
  }
  try {
    await saveReviewSettings(settings);
  } catch {
    return { error: "Reviews could not be saved. Check the database connection and try again." };
  }
  // Homepage and admin pages are dynamic and read selections on every visit.
  // Keep the Google API cache intact when only moderation settings change.
  return { success: true };
}
