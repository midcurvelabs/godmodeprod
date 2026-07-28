"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/episodes";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Wrong code." : "Could not unlock.");
        return;
      }
      const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/episodes";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label
          htmlFor="code"
          className="mb-2 block text-xs uppercase tracking-widest text-text-secondary"
        >
          Access code
        </label>
        <input
          id="code"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-md border border-border bg-bg-elevated px-4 py-3 text-text-primary outline-none focus:border-accent"
          placeholder="••••••••"
        />
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="w-full rounded-md bg-accent px-4 py-3 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}

export default function GatePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <p className="font-display text-5xl tracking-wide text-text-primary">
          GODMODEPROD
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Closed beta — enter the access code to continue.
        </p>
      </div>
      <Suspense fallback={<p className="text-text-secondary">Loading…</p>}>
        <GateForm />
      </Suspense>
    </main>
  );
}
