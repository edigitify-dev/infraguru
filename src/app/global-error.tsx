"use client";

// Replaces the root layout when it fails to render, so it can't rely on the
// site's fonts, Tailwind classes or components — plain inline styles only.
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#f2f6ff",
          color: "#132731",
        }}
      >
        <h1 style={{ fontSize: "2rem", margin: "0 0 12px" }}>We&rsquo;ll be right back</h1>
        <p style={{ maxWidth: 420, lineHeight: 1.7, margin: "0 0 28px", color: "#5c6480" }}>
          Infraguru is temporarily unavailable. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            background: "#132731",
            color: "#fff",
            border: 0,
            borderRadius: 999,
            padding: "12px 28px",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
