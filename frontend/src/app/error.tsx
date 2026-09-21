"use client";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="status-panel" role="alert">
      <h1>Something went wrong</h1>
      <p>The page could not be displayed.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
