import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultReviewSettings, isGoogleReviewVisible, parseReviewSettings,
  selectDisplayReviews, setGoogleReviewVisibility,
  sortReviewsNewestFirst,
} from "../src/lib/reviewSelection.ts";

const google = ["first", "second", "new"].map((id) => ({
  id, authorName: `Reviewer ${id}`, authorPhoto: null,
  authorProfileUrl: "https://www.google.com/maps/contrib/123",
  rating: 4, text: `Review ${id}`, relativeTime: "a month ago",
}));
const manual = {
  id: "manual:11111111-1111-4111-8111-111111111111", authorName: "Client",
  rating: 5, text: "A selected testimonial", relativeTime: "October 2026",
  sourceUrl: "https://example.com/review", hidden: false,
};

test("hidden Google reviews stay excluded while new reviews appear in automatic mode", () => {
  const settings = setGoogleReviewVisibility(defaultReviewSettings(), "second", false);
  assert.deepEqual(selectDisplayReviews(google, settings).map((review) => review.id), ["first", "new"]);
});

test("returned Google reviews are ordered newest first without mutating the input", () => {
  const reviews = [
    { ...google[0], publishedAt: "2025-01-01T00:00:00Z" },
    { ...google[1], publishedAt: "2026-10-14T09:00:00Z" },
    { ...google[2], publishedAt: "invalid" },
  ];
  assert.deepEqual(sortReviewsNewestFirst(reviews).map((review) => review.id), ["second", "first", "new"]);
  assert.equal(reviews[0].id, "first");
});

test("hidden review IDs stay hidden when refreshed reviews change order or text", () => {
  const settings = setGoogleReviewVisibility(defaultReviewSettings(), "first", false);
  const refreshed = sortReviewsNewestFirst([
    { ...google[2], publishedAt: "2026-10-14T09:00:00Z" },
    { ...google[0], text: "Edited by the reviewer", publishedAt: "2026-10-14T10:00:00Z" },
    { ...google[1], publishedAt: "2026-01-01T00:00:00Z" },
  ]);
  assert.deepEqual(selectDisplayReviews(refreshed, settings).map((review) => review.id), ["new", "second"]);
});

test("selected mode only publishes explicitly chosen reviews, including after Google changes its list", () => {
  let settings = { ...defaultReviewSettings(), mode: "selected" };
  assert.deepEqual(selectDisplayReviews(google, settings), []);
  settings = setGoogleReviewVisibility(settings, "first", true);
  assert.deepEqual(selectDisplayReviews(google, settings).map((review) => review.id), ["first"]);
  assert.deepEqual(selectDisplayReviews(google.slice(1), settings), []);
  assert.equal(isGoogleReviewVisible("first", settings), true);
});

test("hiding and restoring a review works in both modes and preserves other choices", () => {
  for (const mode of ["all", "selected"]) {
    let settings = { ...defaultReviewSettings(), mode, selectedIds: ["first", "second"] };
    settings = setGoogleReviewVisibility(settings, "first", false);
    assert.equal(isGoogleReviewVisible("first", settings), false);
    assert.equal(isGoogleReviewVisible("second", settings), true);
    settings = setGoogleReviewVisibility(settings, "first", true);
    settings = setGoogleReviewVisibility(settings, "first", true);
    assert.equal(isGoogleReviewVisible("first", settings), true);
    assert.equal(settings.selectedIds.filter((id) => id === "first").length, 1);
  }
});

test("manual reviews display during a Google outage, keep their source, and can be hidden or removed", () => {
  const settings = { ...defaultReviewSettings(), manualReviews: [manual] };
  const visible = selectDisplayReviews([], settings);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].source, "manual");
  assert.equal(visible[0].sourceUrl, manual.sourceUrl);
  assert.equal(visible[0].authorProfileUrl, null);
  assert.deepEqual(selectDisplayReviews([], { ...settings, manualReviews: [{ ...manual, hidden: true }] }), []);
  assert.deepEqual(selectDisplayReviews([], { ...settings, manualReviews: [] }), []);
});

test("manual additions coexist with selected Google reviews without changing original ratings", () => {
  const settings = { ...defaultReviewSettings(), mode: "selected", selectedIds: ["first"], manualReviews: [manual] };
  const visible = selectDisplayReviews(google, settings);
  assert.deepEqual(visible.map((review) => review.source), ["google", "manual"]);
  assert.equal(visible[0].rating, 4);
  assert.equal(visible[1].rating, 5);
  assert.equal(google.length, 3);
});

test("settings survive a JSON storage round trip and discard unrecognized client fields", () => {
  const settings = { ...defaultReviewSettings(), hiddenIds: ["first", "first"], manualReviews: [{ ...manual, authorName: " Client " }] };
  const parsed = parseReviewSettings(JSON.parse(JSON.stringify({ ...settings, apiKey: "not-persisted" })));
  assert.deepEqual(parsed.hiddenIds, ["first"]);
  assert.equal(parsed.manualReviews[0].authorName, "Client");
  assert.equal("apiKey" in parsed, false);
});

test("unsafe links, invalid ratings, empty text, forged IDs and duplicate entries are rejected", () => {
  for (const changes of [
    { sourceUrl: "javascript:alert(1)" }, { sourceUrl: "http://example.com" },
    { sourceUrl: "https://user:pass@example.com" }, { rating: 0 }, { rating: 6 },
    { rating: 4.5 }, { text: " " }, { authorName: "" }, { hidden: "false" }, { id: "first" },
  ]) {
    assert.throws(() => parseReviewSettings({ ...defaultReviewSettings(), manualReviews: [{ ...manual, ...changes }] }));
  }
  assert.throws(() => parseReviewSettings({ ...defaultReviewSettings(), manualReviews: [manual, manual] }));
});

test("empty optional fields are accepted and server-side size limits are enforced", () => {
  const settings = parseReviewSettings({ ...defaultReviewSettings(), manualReviews: [{ ...manual, sourceUrl: "", relativeTime: "" }] });
  assert.equal(selectDisplayReviews([], settings)[0].sourceUrl, null);
  assert.throws(() => parseReviewSettings({ ...settings, selectedIds: Array(501).fill("first") }));
  assert.throws(() => parseReviewSettings({ ...settings, manualReviews: Array(51).fill(manual) }));
  assert.throws(() => parseReviewSettings({ ...settings, manualReviews: [{ ...manual, text: "a".repeat(5001) }] }));
  assert.throws(() => parseReviewSettings({ ...settings, mode: "invalid" }));
});
