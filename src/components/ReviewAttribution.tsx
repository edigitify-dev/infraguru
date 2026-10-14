export function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 ${i < Math.round(rating) ? "fill-[#d4af37]" : "fill-neutral-300"}`}>
          <path d="M10 1.5l2.6 5.53 6.1.63-4.6 4.16 1.28 5.98L10 14.9l-5.38 2.9 1.28-5.98-4.6-4.16 6.1-.63L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

export function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Google" className="h-6 w-6 shrink-0">
      <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.74z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3a7.15 7.15 0 0 1-10.65-3.76H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.42 14.34a7.2 7.2 0 0 1 0-4.62V6.62H1.4a12 12 0 0 0 0 10.82l4.02-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.45-3.45C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.4 6.62l4.02 3.1A7.15 7.15 0 0 1 12 4.75z" />
    </svg>
  );
}
