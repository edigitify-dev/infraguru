"use client";

import Image from "next/image";

// Last line of defence: public data reads already fall back to cached/static
// content (see db.read in src/lib/db/client.ts), so this mostly catches admin
// screens and unexpected render errors — with a retry, not a raw 500.
export default function Error({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-soft px-6 text-center">
      <Image
        src="/logo.png"
        alt="Infraguru"
        width={160}
        height={52}
        className="mb-10 h-11 w-auto object-contain"
      />
      <span className="eyebrow justify-center">Temporarily Unavailable</span>
      <h1 className="mb-5 max-w-lg text-[clamp(2rem,2.5vw,3rem)] text-primary-dark">
        We&rsquo;ll Be Right Back
      </h1>
      <p className="mb-10 max-w-md text-[1.02rem] leading-[1.7] text-muted">
        Something on our side isn&rsquo;t responding right now. Please try again in a moment.
      </p>
      <button type="button" onClick={() => unstable_retry()} className="btn-primary rounded-full">
        Try Again
      </button>
    </main>
  );
}
