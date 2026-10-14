import { requireAdmin } from "@/lib/auth";
import { getGoogleReviews, getMissingGoogleReviewVariables, isGoogleReviewsConfigured } from "@/lib/googleReviews";
import { getReviewSettings } from "@/lib/db/reviews";
import PageHeader from "@/components/admin/PageHeader";
import ReviewsEditor from "./ReviewsEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews — InfraGuru CMS" };

export default async function AdminReviewsPage() {
  await requireAdmin();
  let settings;
  try {
    settings = await getReviewSettings({ strict: true });
  } catch {
    return (
      <div>
        <PageHeader title="Reviews" description="Choose the reviews displayed on your homepage." />
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Review settings could not be loaded. Check the database connection and reload this page.
        </p>
      </div>
    );
  }
  const google = await getGoogleReviews();
  return (
    <div>
      <PageHeader title="Reviews" description="Choose the reviews displayed on your homepage. Changes here only affect your website." />
      {!google && (
        <p role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {isGoogleReviewsConfigured()
            ? "Google reviews are currently unavailable. Check that Places API (New) and billing are enabled. You can still manage manually added reviews."
            : `Set ${getMissingGoogleReviewVariables().join(" and ")} in your hosting dashboard and apply the changes to load Google reviews. Your local .env.local does not configure production. You can still add selected reviews manually.`}
        </p>
      )}
      {settings && <ReviewsEditor initialSettings={settings} googleReviews={google?.reviews ?? []} fetchedAt={google?.fetchedAt ?? null} googleConfigured={isGoogleReviewsConfigured()} />}
    </div>
  );
}
