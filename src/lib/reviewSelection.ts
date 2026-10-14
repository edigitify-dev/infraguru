export type Review = {
  id: string;
  authorName: string;
  authorPhoto: string | null;
  authorProfileUrl: string | null;
  rating: number;
  text: string;
  relativeTime: string;
  publishedAt?: string;
};

export type ManualReview = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  sourceUrl: string;
  hidden: boolean;
};

export type ReviewSettings = {
  mode: "all" | "selected";
  hiddenIds: string[];
  selectedIds: string[];
  manualReviews: ManualReview[];
};

export type DisplayReview = Review & { source: "google" | "manual"; sourceUrl: string | null };

export type GoogleReviewSummary = { rating: number; reviewCount: number; mapsUri: string | null };

export const GOOGLE_REVIEWS_REFRESH_SECONDS = 60 * 60;

export function sortReviewsNewestFirst<T extends { publishedAt?: string }>(reviews: T[]): T[] {
  const timestamp = (value?: string) => {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [...reviews].sort((a, b) => timestamp(b.publishedAt) - timestamp(a.publishedAt));
}

export function defaultReviewSettings(): ReviewSettings {
  return { mode: "all", hiddenIds: [], selectedIds: [], manualReviews: [] };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid review settings.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, maxLength: number, required = false): string {
  if (typeof value !== "string" || value.length > maxLength || (required && !value.trim())) {
    throw new Error(`${label} ${required ? "is required and " : ""}must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("Too many review selections.");
  return [...new Set(value.map((id) => string(id, "Review ID", 512, true)))];
}

/** Validate on the server as well as the form; never trust client-side limits. */
export function parseReviewSettings(value: unknown): ReviewSettings {
  const data = record(value);
  if (data.mode !== "all" && data.mode !== "selected") throw new Error("Choose a valid display mode.");
  if (!Array.isArray(data.manualReviews) || data.manualReviews.length > 50) {
    throw new Error("You can add up to 50 selected reviews.");
  }
  const seen = new Set<string>();
  const manualReviews = data.manualReviews.map((value): ManualReview => {
    const review = record(value);
    const id = string(review.id, "Review ID", 100, true);
    if (!/^manual:[0-9a-f-]{36}$/.test(id) || seen.has(id)) throw new Error("Invalid or duplicate review ID.");
    seen.add(id);
    if (!Number.isInteger(review.rating) || Number(review.rating) < 1 || Number(review.rating) > 5) {
      throw new Error("Ratings must be whole numbers from 1 to 5.");
    }
    if (typeof review.hidden !== "boolean") throw new Error("Choose whether the review is visible.");
    const sourceUrl = string(review.sourceUrl, "Source link", 2048);
    if (sourceUrl) {
      let url: URL;
      try { url = new URL(sourceUrl); } catch { throw new Error("Enter a valid HTTPS source link."); }
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Enter a valid HTTPS source link.");
      }
    }
    return {
      id,
      authorName: string(review.authorName, "Reviewer name", 100, true),
      rating: Number(review.rating),
      text: string(review.text, "Review text", 5000, true),
      relativeTime: string(review.relativeTime, "Date label", 80),
      sourceUrl,
      hidden: review.hidden,
    };
  });
  return { mode: data.mode, hiddenIds: ids(data.hiddenIds), selectedIds: ids(data.selectedIds), manualReviews };
}

export function isGoogleReviewVisible(id: string, settings: ReviewSettings): boolean {
  return !settings.hiddenIds.includes(id) && (settings.mode === "all" || settings.selectedIds.includes(id));
}

export function setGoogleReviewVisibility(settings: ReviewSettings, id: string, visible: boolean): ReviewSettings {
  return {
    ...settings,
    hiddenIds: visible ? settings.hiddenIds.filter((item) => item !== id) : [...new Set([...settings.hiddenIds, id])],
    selectedIds: visible ? [...new Set([...settings.selectedIds, id])] : settings.selectedIds.filter((item) => item !== id),
  };
}

export function selectDisplayReviews(googleReviews: Review[], settings: ReviewSettings): DisplayReview[] {
  return [
    ...googleReviews.filter((review) => isGoogleReviewVisible(review.id, settings)).map((review): DisplayReview => ({
      ...review, source: "google", sourceUrl: review.authorProfileUrl,
    })),
    ...settings.manualReviews.filter((review) => !review.hidden).map((review): DisplayReview => ({
      id: review.id, authorName: review.authorName, authorPhoto: null, authorProfileUrl: null,
      rating: review.rating, text: review.text, relativeTime: review.relativeTime,
      source: "manual", sourceUrl: review.sourceUrl || null,
    })),
  ];
}
