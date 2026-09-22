"use client";
import { useEffect, useState } from "react";

// 22-admin console skeleton: queue + lookup + audit visibility.
// Solo-founder triage-first (§7): volume/severity in minutes, role-split later.
export default function AdminPage() {
  const [data, setData] = useState<{ role: string | null; queues: { reports: number; disputes: number }; recentEvents: { id: string; event: string; createdAt: string }[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/v1/admin/overview").then(async (r) => {
      const d = await r.json();
      if (!r.ok) setErr(d?.error?.message ?? "Forbidden");
      else setData(d);
    }).catch(() => setErr("Could not load admin overview."));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <h1 className="text-2xl font-bold">Admin &amp; Trust &amp; Safety</h1>
      <p className="mt-1 text-sm text-white/60">Separate route, mandatory 2FA + short sessions at full build (22 §2). Every action requires a reason and lands in the audit log.</p>
      {err && <p className="mt-6 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{err}</p>}
      {data && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-white/50">Role</p><p className="text-lg font-semibold">{data.role ?? "—"}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-white/50">Report signals</p><p className="text-lg font-semibold">{data.queues.reports}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-white/50">Record events</p><p className="text-lg font-semibold">{data.queues.disputes}</p></div>
        </div>
      )}
      {data && (
        <section className="mt-8" aria-label="Recent analytics events">
          <h2 className="font-semibold">Recent events (audit-visible)</h2>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {data.recentEvents.map((e) => <li key={e.id} className="flex justify-between border-b border-white/5 py-1"><span>{e.event}</span><span className="text-white/40">{new Date(e.createdAt).toLocaleString()}</span></li>)}
            {data.recentEvents.length === 0 && <li className="text-white/40">Empty queue — triage in minutes, not hours.</li>}
          </ul>
        </section>
      )}
    </main>
  );
}
