"use client";
import { useState } from "react";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Signing in…");
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setMsg(data?.error?.message ?? `Login failed (HTTP ${res.status}). Check the server console.`);
      else window.location.href = "/repositories";
    } catch {
      setMsg("Login request failed or timed out. Is the dev server running? Check the server console for [klyro] errors.");
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-white">
      <h1 className="text-2xl font-bold">Sign in to Klyro</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Email"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Password" type="password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium hover:bg-indigo-500">Sign in</button>
      </form>
      {msg && <p className="mt-4 text-sm text-white/70">{msg}</p>}
    </div>
  );
}
