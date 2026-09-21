"use client";

export default function ProtectedError({ reset }: { reset: () => void }) {
  return (
    <section className="status-panel" role="alert">
      <h1>Unable to load this page</h1>
      <button type="button" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
