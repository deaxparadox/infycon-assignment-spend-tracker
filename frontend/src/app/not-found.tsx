import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-panel">
      <h1>Page not found</h1>
      <p>The requested page does not exist.</p>
      <Link href="/summary">Return to the summary</Link>
    </main>
  );
}
