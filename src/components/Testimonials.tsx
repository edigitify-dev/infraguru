"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeDown, slideRight, viewportMirror } from "@/lib/motion";
import { TESTIMONIALS_DEFAULT_CONTENT, type TestimonialItem, type TestimonialsContent } from "@/lib/pageSections";
import { useSectionEdit } from "./pagebuilder/SectionEditBoundary";
import EditableText from "./pagebuilder/EditableText";
import EditableVideo from "./pagebuilder/EditableVideo";
import RemoveItemButton from "./pagebuilder/RemoveItemButton";
import AddItemButton from "./pagebuilder/AddItemButton";
import Link from "next/link";
import type { DisplayReview, GoogleReviewSummary } from "@/lib/reviewSelection";
import { GoogleLogo, ReviewStars } from "./ReviewAttribution";

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

/** Autoplaying muted video preview. The declarative `muted`/`autoPlay`
 * attributes alone are unreliable in production builds — React doesn't
 * always commit the `muted` DOM property before the browser evaluates
 * autoplay eligibility, and that race is far more likely to be lost when
 * hydration is fast (prod) than when it's slow (dev). Explicitly setting
 * `.muted` and calling `.play()` from a ref sidesteps that race entirely. */
function AutoplayVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => {});
  }, [src]);

  return <video ref={ref} src={src} muted loop autoPlay playsInline className={className} />;
}

type TestimonialCardData = TestimonialItem & {
  id: string;
  badge: string;
  bgColor: string;
  cmsIndex?: number;
  review?: DisplayReview;
};

/** One testimonial card — either a written quote or a video testimonial,
 * decided once at add-time (see the two "Add Testimonial" buttons below).
 * `AnimatePresence` is scoped inside this component (not at the call site)
 * so each of the two card *slots* keeps its own enter/exit transition as
 * the carousel swaps which underlying item occupies that slot. */
function TestimonialCard({
  item,
  index,
  hiddenOnMobile,
  direction,
  delay,
  onOpenVideo,
}: {
  item: TestimonialCardData;
  index: number;
  hiddenOnMobile?: boolean;
  direction: number;
  delay: number;
  onOpenVideo: (src: string, title: string) => void;
}) {
  const ctx = useSectionEdit();
  const mediaType = item.mediaType ?? "text";

  return (
    <AnimatePresence mode="popLayout" custom={direction}>
      <motion.div
        layout
        key={`card-${index}-${item.id}`}
        custom={direction}
        initial={{ opacity: 0, x: direction > 0 ? 60 : -60, scale: 0.95, filter: "blur(5px)" }}
        animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, x: direction > 0 ? -60 : 60, scale: 0.95, filter: "blur(5px)" }}
        transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        className={`${hiddenOnMobile ? "hidden sm:flex" : "flex"} group relative ${item.bgColor} rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 flex-col justify-between h-full min-h-[400px] sm:min-h-[460px] shadow-sm border border-black/[0.03]`}
      >
        {!item.review && item.cmsIndex !== undefined && <RemoveItemButton arrayPath="items" index={item.cmsIndex} />}

        {/* Top Row: Pill Badge */}
        <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
          <span className="border border-neutral-400/50 rounded-full px-3.5 py-1 text-label font-medium text-neutral-700 font-body bg-white/40">
            {item.badge}
          </span>
          {item.review?.source === "google" && <GoogleLogo />}
        </div>

        {/* Middle: written quote, or a video testimonial */}
        {mediaType === "video" ? (
          <div className="relative flex-1 my-4 sm:my-6 min-h-[180px] overflow-hidden rounded-2xl bg-neutral-900">
            {ctx ? (
              <EditableVideo path={`items[${item.cmsIndex}].video`} fallback={item.video} wrapperClassName="relative h-full w-full">
                {(src) =>
                  src ? (
                    <AutoplayVideo src={src} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/35">
                      <PlayIcon className="h-8 w-8" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide">Video coming soon</span>
                    </div>
                  )
                }
              </EditableVideo>
            ) : item.video ? (
              <button
                type="button"
                onClick={() => onOpenVideo(item.video, item.name)}
                aria-label={`Watch testimonial from ${item.name}`}
                className="group/play relative block h-full w-full cursor-pointer"
              >
                <AutoplayVideo src={item.video} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors duration-300 group-hover/play:bg-black/40">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition-transform duration-300 group-hover/play:scale-110">
                    <PlayIcon className="ml-0.5 h-5 w-5" />
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/35">
                <PlayIcon className="h-8 w-8" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center my-4 sm:my-6">
            <span className="font-heading text-2xl sm:text-3xl text-[#b87d6e] font-light mb-3 sm:mb-4 block">
              66
            </span>
            {item.review ? (
              <div className="flex flex-col gap-4">
                <ReviewStars rating={item.review.rating} />
                <p tabIndex={0} aria-label={`Review by ${item.name}`} className="max-h-[220px] overflow-y-auto whitespace-pre-wrap text-body text-neutral-800 font-normal">{item.quote || "This client left a star rating."}</p>
              </div>
            ) : <EditableText as="p" path={`items[${item.cmsIndex}].quote`} fallback={item.quote} multiline className="text-body text-neutral-800 font-normal" />}
          </div>
        )}

        {/* Bottom Row: Author Details */}
        <div className="pt-6 sm:pt-8 border-t border-black/[0.06] mt-auto">
          {item.review ? (
            <div className="flex items-center gap-3">
              {item.review.authorPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.review.authorPhoto} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              )}
              <div>
                {item.review.authorProfileUrl ? (
                  <a href={item.review.authorProfileUrl} target="_blank" rel="noopener noreferrer" className="font-body font-semibold text-body text-neutral-900 hover:underline">{item.name}</a>
                ) : <h4 className="font-body font-semibold text-body text-neutral-900">{item.name}</h4>}
                <p className="text-caption text-neutral-500 font-medium mt-0.5">{item.role}</p>
                {item.review.source === "manual" && item.review.sourceUrl && (
                  <a href={item.review.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-caption text-primary hover:underline">View source</a>
                )}
              </div>
            </div>
          ) : (
            <>
              <EditableText as="h4" path={`items[${item.cmsIndex}].name`} fallback={item.name} className="font-body font-semibold text-body text-neutral-900 block" />
              <EditableText as="p" path={`items[${item.cmsIndex}].role`} fallback={item.role} className="text-caption text-neutral-500 font-medium mt-0.5" />
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Testimonials({
  content = TESTIMONIALS_DEFAULT_CONTENT,
  reviews = [],
  googleSummary = null,
}: {
  content?: TestimonialsContent;
  reviews?: DisplayReview[];
  googleSummary?: GoogleReviewSummary | null;
}) {
  const ctx = useSectionEdit();
  const live = (ctx?.content as TestimonialsContent | undefined) ?? content;
  const TESTIMONIALS: TestimonialCardData[] = [
    ...reviews.map((review) => ({
      id: review.id, review, name: review.authorName, role: review.relativeTime,
      quote: review.text, avatar: review.authorPhoto ?? "", mediaType: "text" as const, video: "",
      badge: review.source === "google" ? "Google review" : "Selected review",
    })),
    ...live.items.map((item, i) => ({ ...item, id: `cms:${i}`, cmsIndex: i, badge: `${String(i + 1).padStart(2, "0")} Testimonials` })),
  ].map((item, i) => ({ ...item, bgColor: i % 2 === 0 ? "bg-[#f4efe8]" : "bg-[#edf2ee]" }));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const [activeVideo, setActiveVideo] = useState<{ src: string; title: string } | null>(null);
  const closeVideo = useCallback(() => setActiveVideo(null), []);

  useEffect(() => {
    if (!activeVideo) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeVideo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeVideo, closeVideo]);

  const handleNext = () => {
    if (TESTIMONIALS.length < 2) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const handlePrev = () => {
    if (TESTIMONIALS.length < 2) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  if (TESTIMONIALS.length === 0 && !ctx) return null;

  // On desktop/tablet we show 2 cards at once, on mobile we show 1 card
  const card1Index = currentIndex % Math.max(TESTIMONIALS.length, 1);
  const card2Index = (currentIndex + 1) % Math.max(TESTIMONIALS.length, 1);
  const card1 = TESTIMONIALS[card1Index];
  const card2 = TESTIMONIALS[card2Index];

  return (
    <section id="testimonials" className="bg-white">
      <div className="min-h-[100svh] lg:min-h-[100svh] w-full bg-primary-dark px-6 sm:px-10 md:px-14 lg:px-16 py-20 lg:py-24 overflow-hidden flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 items-stretch h-full w-full max-h-[840px]">

          {/* ── LEFT COLUMN: Header & Carousel Navigation Controls ── */}
          <div className="lg:col-span-4 flex flex-col justify-between py-2 sm:py-4">
            <div>
              {/* Premium Heading */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="mb-3 sm:mb-4 flex items-center justify-start gap-3"
              >
                <EditableText
                  as="span"
                  path="eyebrow"
                  fallback={live.eyebrow}
                  className="inline-block font-body text-sm font-semibold uppercase text-gold-gradient tracking-wide"
                />
                <div className="h-[2px] w-8 bg-gold-gradient" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 45 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="font-heading text-[clamp(1.5rem,2.3vw,2.75rem)] font-light tracking-normal text-white leading-tight mb-8 sm:mb-10 lg:mb-12"
              >
                <EditableText as="span" path="headingPlain" fallback={live.headingPlain} /> <br /> <EditableText as="span" path="headingHighlight" fallback={live.headingHighlight} className="font-bold text-gold-gradient" />
              </motion.h2>
              {googleSummary && (
                <div className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <GoogleLogo />
                    <span className="font-heading text-2xl font-semibold">{googleSummary.rating.toFixed(1)}</span>
                    <ReviewStars rating={googleSummary.rating} />
                  </div>
                  <p className="mt-2 text-caption text-white/65">Based on {googleSummary.reviewCount.toLocaleString()} Google reviews</p>
                  {googleSummary.mapsUri && <a href={googleSummary.mapsUri} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-caption font-semibold text-[#f0d375] hover:underline">Read all reviews on Google</a>}
                </div>
              )}
              {ctx && <Link href="/admin/reviews" className="inline-block text-sm font-semibold text-[#f0d375] hover:underline">Manage Google &amp; selected reviews</Link>}
            </div>

            {/* Circular Navigation Buttons */}
            <motion.div
              variants={fadeDown}
              initial="hidden"
              whileInView="visible"
              viewport={viewportMirror}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3.5 mt-4 sm:mt-6"
            >
              <button
                onClick={handlePrev}
                disabled={TESTIMONIALS.length < 2}
                aria-label="Previous testimonial"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-300 shadow-sm active:scale-95 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                disabled={TESTIMONIALS.length < 2}
                aria-label="Next testimonial"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gold-gradient text-neutral-950 flex items-center justify-center transition-all duration-300 shadow-md active:scale-95 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </motion.div>
          </div>

          {/* ── RIGHT COLUMN: Testimonial Cards Carousel Grid ── */}
          <motion.div
            variants={slideRight}
            initial="hidden"
            whileInView="visible"
            viewport={viewportMirror}
            className="lg:col-span-8 overflow-hidden flex items-stretch"
          >
            <div className={`grid grid-cols-1 ${TESTIMONIALS.length > 1 || ctx ? "sm:grid-cols-2" : ""} gap-6 sm:gap-8 w-full h-full`}>
              {card1 && <TestimonialCard
                item={card1}
                index={card1Index}
                direction={direction}
                delay={0}
                onOpenVideo={(src, title) => setActiveVideo({ src, title })}
              />}
              {TESTIMONIALS.length > 1 && <TestimonialCard
                item={card2}
                index={card2Index}
                hiddenOnMobile
                direction={direction}
                delay={0.08}
                onOpenVideo={(src, title) => setActiveVideo({ src, title })}
              />}

              {ctx && (
                <div className="hidden sm:flex min-h-[400px] sm:min-h-[460px] flex-col gap-3">
                  <AddItemButton
                    arrayPath="items"
                    newItem={{ name: "New Person", role: "Role / Title", quote: "Add a testimonial quote…", avatar: "/about-1.jpg", mediaType: "text", video: "" }}
                    label="Add Testimonial (Text)"
                    className="flex flex-1 items-center justify-center rounded-[24px] sm:rounded-[32px] border-2 border-dashed border-[#032E97]/20 text-xs font-bold uppercase tracking-wide text-white/40 transition-colors hover:border-white/40 hover:text-white/70"
                  />
                  <AddItemButton
                    arrayPath="items"
                    newItem={{ name: "New Person", role: "Role / Title", quote: "", avatar: "/about-1.jpg", mediaType: "video", video: "" }}
                    label="Add Testimonial (Video)"
                    className="flex flex-1 items-center justify-center rounded-[24px] sm:rounded-[32px] border-2 border-dashed border-[#032E97]/20 text-xs font-bold uppercase tracking-wide text-white/40 transition-colors hover:border-white/40 hover:text-white/70"
                  />
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Fullscreen lightbox for video testimonials — sound on, controls visible */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-primary-dark/97 backdrop-blur-md"
            onClick={closeVideo}
          >
            <button
              type="button"
              onClick={closeVideo}
              aria-label="Close"
              className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-8 sm:top-8"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative mx-auto flex h-[78vh] w-[92vw] max-w-5xl flex-col items-center justify-center gap-4 sm:h-[82vh]"
            >
              <video src={activeVideo.src} controls autoPlay playsInline className="h-full w-full object-contain" />
              <p className="text-center font-body text-sm font-medium uppercase tracking-wide text-white/70">
                {activeVideo.title}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
