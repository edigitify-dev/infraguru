"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormSection from "@/components/admin/FormSection";
import { inputClass, labelClass } from "@/components/admin/formStyles";
import { isGoogleReviewVisible, setGoogleReviewVisibility, type ManualReview, type Review, type ReviewSettings } from "@/lib/reviewSelection";
import { refreshGoogleReviewsAction, saveReviewsAction } from "./actions";

const buttonClass = "rounded-lg border border-[#032E97]/15 px-4 py-2 text-sm font-medium text-[#0a1435] transition-colors hover:bg-[#032E97]/5 disabled:opacity-50";

export default function ReviewsEditor({ initialSettings, googleReviews, fetchedAt, googleConfigured }: {
  initialSettings: ReviewSettings;
  googleReviews: Review[];
  fetchedAt: string | null;
  googleConfigured: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(initialSettings));
  const [message, setMessage] = useState<{ error?: string; success?: boolean }>({});
  const [pending, startTransition] = useTransition();
  const [refreshPending, startRefreshTransition] = useTransition();
  const [refreshMessage, setRefreshMessage] = useState<{ error?: string; success?: boolean }>({});
  const dirty = JSON.stringify(settings) !== savedSnapshot;
  const visibleCount = googleReviews.filter((review) => isGoogleReviewVisible(review.id, settings)).length
    + settings.manualReviews.filter((review) => !review.hidden).length;

  function update(next: ReviewSettings) {
    setSettings(next);
    setMessage({});
  }

  function toggleGoogle(id: string, visible: boolean) {
    update(setGoogleReviewVisibility(settings, id, visible));
  }

  function updateManual(id: string, changes: Partial<ManualReview>) {
    update({ ...settings, manualReviews: settings.manualReviews.map((review) => review.id === id ? { ...review, ...changes } : review) });
  }

  function addManual() {
    update({ ...settings, manualReviews: [...settings.manualReviews, {
      id: `manual:${crypto.randomUUID()}`, authorName: "", rating: 5, text: "",
      relativeTime: "", sourceUrl: "", hidden: false,
    }] });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await saveReviewsAction(settings);
        setMessage(result);
        if (result.success) {
          setSavedSnapshot(JSON.stringify(settings));
          router.refresh();
        }
      } catch {
        setMessage({ error: "Reviews could not be saved. Please try again." });
      }
    });
  }

  function refreshGoogle() {
    startRefreshTransition(async () => {
      setRefreshMessage({});
      try {
        const result = await refreshGoogleReviewsAction();
        if (result.error) setRefreshMessage({ error: result.error });
        else {
          setRefreshMessage({ success: true });
          router.refresh();
        }
      } catch {
        setRefreshMessage({ error: "Google reviews could not be refreshed. Please try again." });
      }
    });
  }

  return (
    <form onSubmit={save}>
      <fieldset disabled={pending || refreshPending} className="flex min-w-0 flex-col gap-6">
        <FormSection title="Display settings" description="Save your changes to publish them on the homepage.">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[#0a1435]">
            <input type="radio" name="mode" value="all" checked={settings.mode === "all"} onChange={() => update({ ...settings, mode: "all" })} className="mt-1 accent-[#032E97]" />
            <span><span className="font-semibold">Automatically show new Google reviews</span><br /><span className="text-xs text-[#5c6480]">New reviews returned by Google appear automatically. Reviews you hide stay hidden after updates.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[#0a1435]">
            <input type="radio" name="mode" value="selected" checked={settings.mode === "selected"} onChange={() => update({ ...settings, mode: "selected" })} className="mt-1 accent-[#032E97]" />
            <span><span className="font-semibold">Only show selected Google reviews</span><br /><span className="text-xs text-[#5c6480]">Check the reviews below to include them. New reviews stay hidden until selected.</span></span>
          </label>
          <p className="text-sm text-[#5c6480]">{visibleCount} reviews will appear in the Testimonials carousel from the current list. Existing testimonials and videos can be managed in the homepage editor.</p>
        </FormSection>

        <FormSection title="Google reviews" description="The list refreshes automatically on visits after one hour. Google chooses up to five relevant reviews; we show those newest first. Uncheck a review and save to hide it from your website.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#5c6480]">
              {fetchedAt ? `Last refreshed: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(fetchedAt))} IST` : "No successful Google refresh yet."}
            </p>
            <button type="button" onClick={refreshGoogle} disabled={!googleConfigured || dirty || refreshPending} className={buttonClass}>{refreshPending ? "Refreshing…" : "Refresh now"}</button>
          </div>
          {dirty && <p className="text-xs text-[#5c6480]">Save your changes before refreshing Google reviews.</p>}
          <div aria-live="polite">
            {refreshMessage.error && <p role="alert" className="text-sm text-red-600">{refreshMessage.error}</p>}
            {refreshMessage.success && <p className="text-sm text-emerald-700">Google reviews refreshed. Hidden reviews remain hidden.</p>}
          </div>
          {googleReviews.length === 0 && <p className="text-sm text-[#5c6480]">No Google reviews are available right now. Existing selections are preserved.</p>}
          {googleReviews.map((review) => {
            const visible = isGoogleReviewVisible(review.id, settings);
            return (
              <div key={review.id} className={`rounded-xl border p-4 ${visible ? "border-[#032E97]/15" : "border-gray-200 bg-gray-50"}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {review.authorProfileUrl ? (
                      <a href={review.authorProfileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#032E97] hover:underline">{review.authorName}</a>
                    ) : <span className="font-semibold text-[#0a1435]">{review.authorName}</span>}
                    <p className="mt-1 text-xs text-[#5c6480]">{review.rating}/5 stars · {review.relativeTime}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#0a1435]">
                    <input type="checkbox" checked={visible} onChange={(event) => toggleGoogle(review.id, event.target.checked)} className="h-4 w-4 accent-[#032E97]" />
                    {visible ? "Shown on website" : "Hidden from website"}
                  </label>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5c6480]">{review.text || "This review has no written text."}</p>
              </div>
            );
          })}
        </FormSection>

        <FormSection title="Add selected reviews" description="Enter reviews or client testimonials you have chosen to feature. Manual entries are labelled Selected review, with a source link when provided; they are not marked as verified by Google.">
          {settings.manualReviews.length === 0 && <p className="text-sm text-[#5c6480]">Add a review below, including reviews outside the list supplied by Google.</p>}
          {settings.manualReviews.map((review, index) => (
            <div key={review.id} className="flex flex-col gap-4 rounded-xl border border-[#032E97]/10 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#0a1435]">Selected review {index + 1}</h3>
                <button type="button" onClick={() => update({ ...settings, manualReviews: settings.manualReviews.filter((item) => item.id !== review.id) })} className="text-sm font-medium text-red-600 hover:underline">Remove review</button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>Reviewer name</span>
                  <input required maxLength={100} value={review.authorName} onChange={(event) => updateManual(review.id, { authorName: event.target.value })} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Rating</span>
                  <select value={review.rating} onChange={(event) => updateManual(review.id, { rating: Number(event.target.value) })} className={inputClass}>
                    {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} {rating === 1 ? "star" : "stars"}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span className={labelClass}>Review text</span>
                <textarea required maxLength={5000} rows={4} value={review.text} onChange={(event) => updateManual(review.id, { text: event.target.value })} className={inputClass} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>Date label (optional)</span>
                  <input maxLength={80} placeholder="e.g. October 2026" value={review.relativeTime} onChange={(event) => updateManual(review.id, { relativeTime: event.target.value })} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Source link (optional)</span>
                  <input type="url" pattern="https://.*" maxLength={2048} placeholder="https://…" value={review.sourceUrl} onChange={(event) => updateManual(review.id, { sourceUrl: event.target.value })} className={inputClass} />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#0a1435]">
                <input type="checkbox" checked={!review.hidden} onChange={(event) => updateManual(review.id, { hidden: !event.target.checked })} className="h-4 w-4 accent-[#032E97]" />
                Show this review on the website
              </label>
            </div>
          ))}
          <button type="button" onClick={addManual} disabled={settings.manualReviews.length >= 50} className={`${buttonClass} self-start`}>+ Add selected review</button>
        </FormSection>
      </fieldset>

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#032E97]/10 bg-white p-4 shadow-lg">
        <div aria-live="polite" className="text-sm">
          {message.error ? <p role="alert" className="text-red-600">{message.error}</p>
            : message.success ? <p className="text-emerald-700">Reviews saved. Your homepage now uses these selections.</p>
            : <p className="text-[#5c6480]">{dirty ? "You have unsaved changes." : "Changes are saved."}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/#testimonials" target="_blank" rel="noopener noreferrer" className={buttonClass}>View homepage</Link>
          <button type="submit" disabled={pending || refreshPending || !dirty} className="rounded-lg bg-[#032E97] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a1435] disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving…" : "Save reviews"}</button>
        </div>
      </div>
    </form>
  );
}
