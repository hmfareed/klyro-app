"use client";
import { useState } from "react";

export default function SignupPage() {
  const [form, setForm] = useState({ email: "", password: "", username: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) { setMsg("Please accept the Terms to continue (21 §4 — IP deal must be known before joining)."); return; }
    setMsg("Creating…");
    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setMsg(data?.error?.message ?? `Signup failed (HTTP ${res.status}). Check the server console.`);
      else {
        setMsg("Account created. Check server console / Mailhog :8025 for the verify link, then continue to onboarding.");
        window.location.href = "/onboarding";
      }
    } catch {
      setMsg("Signup request failed or timed out. Is the dev server running? Check the server console for [klyro] errors.");
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-white">
      <h1 className="text-2xl font-bold">Create your Klyro account</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Email"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Username (3-39, letters/numbers/hyphens)"
          value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <div className="relative">
          <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 pr-16" placeholder="Password (10+ chars)" type={showPassword ? "text" : "password"}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-2 px-3 text-sm text-white/60 hover:text-white">
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <label className="flex items-start gap-2 text-xs text-white/60">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
          <span>I agree to the <a href="/terms" className="underline">Terms</a> — Klyro is a venue, not a party to project IP/equity (21 §4).</span>
        </label>
        <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium hover:bg-indigo-500">Sign up</button>
      </form>
      {msg && <p className="mt-4 text-sm text-white/70">{msg}</p>}
    </div>
  );
}
