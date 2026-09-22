"use client";
import { useState } from "react";

export default function SignupPage() {
  const [form, setForm] = useState({ email: "", password: "", username: "" });
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Password (10+ chars)" type="password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium hover:bg-indigo-500">Sign up</button>
      </form>
      {msg && <p className="mt-4 text-sm text-white/70">{msg}</p>}
    </div>
  );
}
