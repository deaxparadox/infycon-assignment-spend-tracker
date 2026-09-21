"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "./auth-provider";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { state, logout, retryBootstrap } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (state.status === "anonymous" && !loggingOut) {
      const currentPath = `${pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
    }
  }, [loggingOut, pathname, router, state.status]);

  if (state.status === "loading" || state.status === "anonymous") {
    return <p className="status-panel">Restoring your session…</p>;
  }
  if (state.status === "error") {
    return (
      <section className="status-panel" role="alert">
        <p>{state.message}</p>
        <button type="button" onClick={() => void retryBootstrap()}>
          Retry
        </button>
      </section>
    );
  }

  async function handleLogout() {
    setLoggingOut(true);
    const serverSessionCleared = await logout();
    router.replace(serverSessionCleared ? "/login" : "/login?logout=incomplete");
  }

  return (
    <div className="app-shell">
      <header>
        <Link className="brand" href="/summary">
          Spend Tracker
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/summary">Summary</Link>
          <Link href="/expenses">Expenses</Link>
          <Link href="/expenses/new">Add expense</Link>
        </nav>
        <div className="account-actions">
          <span>{state.user.email}</span>
          <button disabled={loggingOut} type="button" onClick={() => void handleLogout()}>
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
