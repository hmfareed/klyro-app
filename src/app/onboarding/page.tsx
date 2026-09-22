"use client";
import { useState } from "react";

// Onboarding steps 1-5 per 03-auth (skippable after username, which signup already captured).
export default function OnboardingPage() {
  const [form, setForm] = useState({ displayName: "", bio: "", about: "", location: "", websiteUrl: "", intent: "both" });
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Saving…");
    const res = await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, websiteUrl: form.websiteUrl || undefined }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error?.message ?? "Save failed");
    else {
      setMsg("Profile saved.");
      window.location.href = `/u/${data.user.username}`;
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-white">
      <h1 className="text-2xl font-bold">Tell people who you are</h1>
      <p className="mt-1 text-sm text-white/60">Step 2-5 of onboarding. Skills tagging (step 4) lands with the profile editor next.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Display name"
          value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Bio (160 chars)"
          value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={160} />
        <textarea className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="About (markdown)"
          value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} rows={4} />
        <div className="flex gap-3">
          <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Location"
            value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <select className="rounded-lg bg-white/5 border border-white/10 px-4 py-3"
            value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })}>
            <option value="start">I want to start</option>
            <option value="join">I want to join</option>
            <option value="both">Both</option>
          </select>
        </div>
        <input className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3" placeholder="Website URL"
          value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
        <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium hover:bg-indigo-500">Save & continue</button>
      </form>
      {msg && <p className="mt-4 text-sm text-white/70">{msg}</p>}
    </div>
  );
}
