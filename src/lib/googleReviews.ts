import { unstable_cache } from "next/cache";
import "server-only";
import { GOOGLE_REVIEWS_REFRESH_SECONDS, sortReviewsNewestFirst, type Review } from "./reviewSelection";

// Live Google reviews, pulled from the Places API (New) "Place Details"
// endpoint. Credentials are read lazily so the app can boot before they're
// set — manually selected reviews can still appear without Google credentials.
// The homepage renders `dynamic = "force-dynamic"`, which would otherwise
// force every fetch to `no-store`; wrapping the call in `unstable_cache`
// keeps it on its own revalidate schedule instead of hitting Google's
// (billed) API on every single page load.
export type GoogleReview = Review;

export type GooglePlaceReviews = {
  rating: number;
  reviewCount: number;
  mapsUri: string | null;
  reviews: GoogleReview[];
  fetchedAt: string;
};

function getConfig() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeId = process.env.GOOGLE_PLACE_ID?.trim();
  if (!apiKey || !placeId) return null;
  return { apiKey, placeId };
}

export function isGoogleReviewsConfigured(): boolean {
  return getConfig() !== null;
}

export function getMissingGoogleReviewVariables(): string[] {
  return ["GOOGLE_PLACES_API_KEY", "GOOGLE_PLACE_ID"].filter((name) => !process.env[name]?.trim());
}

let warnedMissingConfiguration = false;

type PlacesApiReview = {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  publishTime?: string;
  text?: { text: string };
  originalText?: { text: string };
  authorAttribution?: { displayName: string; photoUri?: string; uri?: string };
};

type PlacesApiResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesApiReview[];
};

async function fetchGoogleReviews(placeId: string): Promise<GooglePlaceReviews | null> {
  const config = getConfig();
  if (!config) return null;

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "X-Goog-Api-Key": config.apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
    },
  });

  if (!res.ok) {
    console.error(`Google Places API request failed: ${res.status} ${await res.text().catch(() => res.statusText)}`);
    // Do not cache a failed request for an hour; the next visit may retry.
    throw new Error("Google Places API request failed.");
  }

  const data = (await res.json()) as PlacesApiResponse;

  return {
    rating: data.rating ?? 0,
    reviewCount: data.userRatingCount ?? 0,
    mapsUri: data.googleMapsUri ?? null,
    fetchedAt: new Date().toISOString(),
    reviews: sortReviewsNewestFirst((data.reviews ?? []).map((r) => ({
      id: r.name,
      authorName: r.authorAttribution?.displayName ?? "Google User",
      authorPhoto: r.authorAttribution?.photoUri ?? null,
      authorProfileUrl: r.authorAttribution?.uri ?? null,
      rating: r.rating,
      text: r.originalText?.text ?? r.text?.text ?? "",
      relativeTime: r.relativePublishTimeDescription,
      publishedAt: r.publishTime,
    }))),
  };
}

const getCachedGoogleReviews = unstable_cache(fetchGoogleReviews, ["google-place-reviews-hourly-v2"], {
  revalidate: GOOGLE_REVIEWS_REFRESH_SECONDS,
  tags: ["google-reviews"],
});

export async function getGoogleReviews(): Promise<GooglePlaceReviews | null> {
  const config = getConfig();
  if (!config) {
    if (!warnedMissingConfiguration) {
      console.warn(`[reviews] Google reviews are disabled. Set ${getMissingGoogleReviewVariables().join(" and ")} in the server environment. Local .env.local values do not configure your hosting account.`);
      warnedMissingConfiguration = true;
    }
    return null;
  }
  try {
    // The Place ID participates in the cache key when the business changes.
    return await getCachedGoogleReviews(config.placeId);
  } catch {
    console.error("Google Places API is unavailable.");
    return null;
  }
}
