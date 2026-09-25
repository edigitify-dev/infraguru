"use client";

import { useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fadeUp, fadeIn, viewportMirror } from "@/lib/motion";
import type { JobOpening } from "@/lib/db/types";
import { submitApplicationAction } from "@/app/careers/apply-actions";

function PinIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h2.28a1 1 0 01.98.8l1 4.5a1 1 0 01-.5 1.09L7 10.5a11.5 11.5 0 006.5 6.5l1.11-1.76a1 1 0 011.09-.5l4.5 1a1 1 0 01.8.98V19a2 2 0 01-2 2h-1C10.4 21 3 13.6 3 4V5z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 10.5l4-4a3 3 0 10-4.24-4.24l-5 5a3 3 0 000 4.24m-2 2l-4 4a3 3 0 104.24 4.24l5-5a3 3 0 000-4.24" />
    </svg>
  );
}

function UploadCloudIcon() {
  return (
    <svg className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 18a4.5 4.5 0 01-.5-8.97A5.5 5.5 0 0117 8.5a4 4 0 01-.5 7.97M12 12v7m0-7l-3 3m3-3l3 3" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 3v5h5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12" />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const inputClasses =
  "w-full rounded-lg border border-primary-dark/12 bg-primary-dark/2 px-4 py-3 font-body text-sm text-ink placeholder-ink/40 outline-none transition-colors focus:border-secondary/60 focus:bg-white";

const fieldWrapClasses = "relative flex items-center";
const iconSlotClasses = "pointer-events-none absolute left-4 text-ink/35";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-primary-dark/60">
      {children}
    </span>
  );
}

export default function CareerApplyPage({
  job,
  otherOpenings,
}: {
  job: JobOpening;
  otherOpenings: JobOpening[];
}) {
  const [submitted, setSubmitted] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = (file: File | undefined | null) => {
    if (file) setResumeFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await submitApplicationAction({
          jobId: job.id,
          jobTitleSnapshot: job.title,
          fullName: String(formData.get("fullName") || ""),
          email: String(formData.get("email") || ""),
          phone: String(formData.get("phone") || ""),
          portfolioUrl: String(formData.get("portfolioUrl") || ""),
          coverNote: String(formData.get("coverNote") || ""),
          resume: resumeFile,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  };

  return (
    <main className="bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#253d67] to-primary-dark pb-16 pt-32 sm:pb-20 sm:pt-40">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-secondary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />

        <div className="relative mx-auto max-w-[90rem] px-6 lg:px-12 xl:px-16">
          <motion.div variants={fadeIn} initial="hidden" animate="visible">
            <Link
              href="/careers#careers-openings"
              className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/55 transition-colors hover:text-secondary"
            >
              <ArrowLeftIcon />
              All Open Roles
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-0.5 w-8 bg-gold-gradient" />
              <span className="font-body text-sm font-semibold uppercase tracking-[0.2em] text-gold-gradient">
                {job.department} · InfraGuru
              </span>
            </div>
            <h1 className="max-w-4xl font-heading text-[clamp(2.1rem,3.1vw,3.75rem)] font-light leading-[1.08] tracking-normal text-white">
              {job.title}
            </h1>

            <div className="mt-9 flex flex-wrap items-center gap-x-9 gap-y-3 border-t border-white/10 pt-7 text-sm text-white/70">
              <span className="flex items-center gap-2">
                <PinIcon />
                {job.address ?? job.location}
              </span>
              <span className="flex items-center gap-2">
                <ClockIcon />
                {job.workMode}
              </span>
              <span className="flex items-center gap-2">
                <BriefcaseIcon />
                {job.department}
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Body */}
      <section className="w-full bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-14 px-6 lg:grid-cols-[1fr_520px] lg:gap-16 lg:px-12 xl:px-16">
          {/* Job details */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportMirror}
            className="flex max-w-3xl flex-col"
          >
            <section>
              <h2 className="mb-4 font-heading text-2xl font-bold text-primary-dark">Job Overview</h2>
              <p className="text-body font-light leading-relaxed text-neutral-600">{job.overview}</p>
            </section>

            <section className="mt-12 border-t border-hairline pt-12">
              <h2 className="mb-6 font-heading text-2xl font-bold text-primary-dark">Key Responsibilities</h2>
              <div className="flex flex-col gap-8">
                {job.responsibilities.map((group, gi) => (
                  <div key={group.heading ?? gi}>
                    {group.heading && (
                      <h3 className="mb-3 text-label font-bold uppercase tracking-wide text-primary">
                        {group.heading}
                      </h3>
                    )}
                    <ul className="flex flex-col gap-3.5">
                      {group.items.map((item, ii) => (
                        <li key={item} className="flex items-start gap-4 text-body font-light leading-relaxed text-neutral-600">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-dark/5 font-body text-[11px] font-bold text-primary">
                            {String(ii + 1).padStart(2, "0")}
                          </span>
                          <span className="pt-0.5">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-12 border-t border-hairline pt-12">
              <h2 className="mb-6 font-heading text-2xl font-bold text-primary-dark">Qualifications &amp; Skills</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                {job.qualifications.map((q) => (
                  <div key={q.label} className="border-l-2 border-secondary/40 pl-4">
                    <dt className="mb-1 text-caption font-bold uppercase tracking-[0.15em] text-secondary-hover">
                      {q.label}
                    </dt>
                    <dd className="text-body font-light leading-relaxed text-neutral-600">{q.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-12 border-t border-hairline pt-12">
              <h2 className="mb-6 font-heading text-2xl font-bold text-primary-dark">Why Join Us?</h2>
              <ul className="flex flex-col gap-4">
                {job.whyJoin.map((item) => (
                  <li key={item} className="flex items-start gap-3.5 text-body font-light leading-relaxed text-neutral-600">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-primary-dark">
                      <CheckIcon />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>

          {/* Application form */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportMirror}
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <div className="overflow-hidden rounded-[26px] border border-hairline bg-white shadow-[0_30px_70px_rgba(3,46,151,0.12)]">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#253d67] to-primary-dark px-8 pb-7 pt-8">
                <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-secondary/15 blur-2xl" />
                <div className="relative z-10 mb-3 flex items-center gap-2.5">
                  <div className="h-0.5 w-5 bg-gold-gradient" />
                  <span className="text-caption font-bold uppercase tracking-[0.2em] text-gold-gradient">
                    Apply For This Role
                  </span>
                </div>
                <h3 className="relative z-10 font-heading text-xl font-semibold text-white">{job.title}</h3>
                <p className="relative z-10 mt-1.5 flex items-center gap-1.5 text-xs font-medium text-white/60">
                  {job.location} &middot; {job.workMode}
                </p>
              </div>

              <div className="p-8">
                {submitted ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary-dark">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="h-6 w-6">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <h4 className="mb-2 font-heading text-xl font-bold text-primary-dark">
                      Application Received
                    </h4>
                    <p className="font-body text-sm text-ink/60">
                      Thank you for your interest in InfraGuru. Our talent team will review your
                      profile and reach out within 3-5 business days.
                    </p>
                  </div>
                ) : (
                  <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <FieldLabel>Full Name</FieldLabel>
                        <div className={fieldWrapClasses}>
                          <span className={iconSlotClasses}>
                            <UserIcon />
                          </span>
                          <input
                            type="text"
                            name="fullName"
                            required
                            placeholder="Jane Doe"
                            className={`${inputClasses} pl-11`}
                          />
                        </div>
                      </label>

                      <label className="block">
                        <FieldLabel>Email</FieldLabel>
                        <div className={fieldWrapClasses}>
                          <span className={iconSlotClasses}>
                            <MailIcon />
                          </span>
                          <input
                            type="email"
                            name="email"
                            required
                            placeholder="jane@email.com"
                            className={`${inputClasses} pl-11`}
                          />
                        </div>
                      </label>

                      <label className="block">
                        <FieldLabel>Phone</FieldLabel>
                        <div className={fieldWrapClasses}>
                          <span className={iconSlotClasses}>
                            <PhoneIcon />
                          </span>
                          <input
                            type="tel"
                            name="phone"
                            required
                            placeholder="+91 00000 00000"
                            className={`${inputClasses} pl-11`}
                          />
                        </div>
                      </label>

                      <label className="block sm:col-span-2">
                        <FieldLabel>Portfolio / LinkedIn (optional)</FieldLabel>
                        <div className={fieldWrapClasses}>
                          <span className={iconSlotClasses}>
                            <LinkIcon />
                          </span>
                          <input
                            type="text"
                            name="portfolioUrl"
                            placeholder="https://"
                            className={`${inputClasses} pl-11`}
                          />
                        </div>
                      </label>
                    </div>

                    <div>
                      <FieldLabel>Resume</FieldLabel>
                      <input
                        ref={fileInputRef}
                        type="file"
                        required
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => pickFile(e.target.files?.[0])}
                      />

                      {resumeFile ? (
                        <div className="flex items-center gap-3 rounded-lg border border-secondary/40 bg-secondary/6 px-4 py-3.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-gradient text-primary-dark">
                            <FileTextIcon />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-body text-sm font-semibold text-primary-dark">
                              {resumeFile.name}
                            </p>
                            <p className="text-xs text-muted">{formatFileSize(resumeFile.size)}</p>
                          </div>
                          <button
                            type="button"
                            aria-label="Remove resume"
                            onClick={() => {
                              setResumeFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-ink/5 hover:text-red-500"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="resume-upload"
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                          }}
                          onDragLeave={() => setDragActive(false)}
                          onDrop={handleDrop}
                          onClick={(e) => {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }}
                          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors ${
                            dragActive
                              ? "border-secondary bg-secondary/8"
                              : "border-primary-dark/15 bg-primary-dark/2 hover:border-secondary/50 hover:bg-secondary/4"
                          }`}
                        >
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-dark/5 text-primary">
                            <UploadCloudIcon />
                          </span>
                          <span className="font-body text-sm font-semibold text-primary-dark">
                            Drop your resume, or <span className="text-secondary-hover underline">browse</span>
                          </span>
                          <span className="text-xs text-muted">PDF, DOC or DOCX &middot; up to 5MB</span>
                        </label>
                      )}
                    </div>

                    <label className="block">
                      <FieldLabel>Note To The Hiring Team (optional)</FieldLabel>
                      <textarea
                        name="coverNote"
                        rows={4}
                        placeholder="Tell us why you're a great fit..."
                        className={`${inputClasses} resize-none`}
                      />
                    </label>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                      type="submit"
                      disabled={pending}
                      className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-gold-gradient px-8 py-4 font-body text-sm font-bold uppercase tracking-widest text-primary-dark shadow-[0_10px_24px_rgba(212,175,55,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(212,175,55,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pending ? "Submitting…" : "Submit Application"}
                    </button>

                    <p className="text-center text-[11px] text-muted">
                      By applying, you agree to InfraGuru processing your data for recruitment purposes.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Other openings */}
      {otherOpenings.length > 0 && (
        <section className="w-full bg-bg-soft py-16 sm:py-24">
          <div className="mx-auto max-w-[90rem] px-6 lg:px-12 xl:px-16">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={viewportMirror}
              className="mb-10 flex items-center gap-3"
            >
              <div className="h-0.5 w-8 bg-gold-gradient" />
              <span className="font-body text-sm font-semibold uppercase tracking-wide text-secondary-hover">
                Other Roles
              </span>
            </motion.div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {otherOpenings.map((role) => (
                <Link
                  key={role.slug}
                  href={`/careers/apply/${role.slug}`}
                  className="group flex flex-col gap-2 rounded-2xl border border-hairline bg-white px-6 py-6 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_20px_40px_rgba(3,46,151,0.1)]"
                >
                  <span className="text-caption font-semibold uppercase tracking-[0.2em] text-secondary-hover">
                    {role.department}
                  </span>
                  <span className="font-heading text-lg font-semibold text-primary-dark">
                    {role.title}
                  </span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {role.workMode}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
