"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// 30-onboarding full flow: Screens 3–7 with entry-point branches (§2, §5),
// resumable progress (§6), live username validation + suggestions (§7),
// analytics per transition (§8), a11y + progress indicator (§9).
// Only username is a hard gate (§1); everything past it is skippable.

type Entry = "organic" | "project" | "group" | "referral" | "oauth";
type Intent = "start" | "join" | "both";

const STEPS = ["Username", "Basics", "About", "Skills", "Intent", "Done"] as const;

function track(event: string, props?: Record<string, string>) {
  fetch("/api/v1/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {});
}

function OnboardingWizard() {
  const params = useSearchParams();
  const entry: Entry = (params.get("entry") as Entry) || "organic";
  const next = params.get("next") || "";
  const ref = params.get("ref") || "";
  const isNonOrganic = entry === "project" || entry === "group" || entry === "referral";
  const totalSteps = isNonOrganic ? 4 : 5; // intent skipped for non-organic (§5)

  const [step, setStep] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [username, setUsername] = useState("");
  const [check, setCheck] = useState<{ available: boolean; reason?: string; suggestions: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({ displayName: "", bio: "", about: "", location: "", websiteUrl: "" });
  const [skills, setSkills] = useState<{ name: string; level: string }[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [intent, setIntent] = useState<Intent>("both");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // §6 resume + §8 onboarding_started {entry_point}
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/onboarding");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const u = data.user;
        if (u?.username) setUsername(u.username);
        if (u?.displayName) setForm((f) => ({ ...f, displayName: u.displayName ?? "", bio: u.bio ?? "", about: u.about ?? "", location: u.location ?? "", websiteUrl: u.websiteUrl ?? "" }));
        // Resume where left off (server-inferred step 4–8 → wizard index).
        const s: number = data.step ?? 4;
        if (s >= 8) {
          setResumed(true);
          finish(true);
          return;
        }
        if (s > 4) setStep(Math.min(s - 4, totalSteps - 1));
        setResumed(true);
      } catch { setResumed(true); }
    })();
    track("onboarding_started", { entry_point: entryPointProp(entry) });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §4 Screen 3: live validation as the user types.
  const onUsernameChange = useCallback((v: string) => {
    setUsername(v);
    setCheck(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (v.trim().length < 3) return;
    debounce.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/v1/users/check-username?username=${encodeURIComponent(v.trim())}`);
        const data = await res.json();
        setCheck(data.available !== false ? { available: true, suggestions: [] } : data);
      } catch { /* offline: validate on submit */ }
      setChecking(false);
    }, 350);
  }, []);

  function stepLabel() {
    return `Step ${Math.min(step + 1, totalSteps)} of ${totalSteps}`;
  }

  async function saveProfile(skip = false) {
    setSaving(true);
    setMsg(skip ? "Skipped — you can fill this in later." : "Saving…");
    try {
      if (!skip || form.displayName || form.bio) {
        const res = await fetch("/api/v1/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, websiteUrl: form.websiteUrl || undefined, skills: skills.map((s) => ({ name: s.name, level: s.level })) }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setMsg(data?.error?.message ?? "Save failed. Try again.");
          setSaving(false);
          return false;
        }
      }
      track(skip ? "onboarding_step_skipped" : "profile_basics_completed", { step: STEPS[step].toLowerCase() });
      try {
        await fetch("/api/v1/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryPoint: entryPointEnum(entry), step: step + 4 }) });
      } catch { /* progress best-effort */ }
      return true;
    } finally {
      setSaving(false);
    }
  }

  function addSkill() {
    const name = skillInput.trim().toLowerCase();
    if (!name || skills.length >= 20 || skills.some((s) => s.name === name)) return;
    setSkills([...skills, { name, level: "INTERMEDIATE" }]);
    setSkillInput("");
  }

  async function finish(silent = false) {
    // §5: non-organic skips intent — land where they came from.
    let dest = "/";
    if (entry === "project" || entry === "group") dest = next || "/";
    else if (entry === "referral") dest = ref ? `/u/${ref}` : "/";
    else if (intent === "start") dest = "/projects/new";
    if (!silent) {
      setSaving(true);
      try {
        await fetch("/api/v1/users/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: isNonOrganic ? undefined : intent }) });
        await fetch("/api/v1/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryPoint: entryPointEnum(entry), ...(isNonOrganic ? {} : { intent: intent.toUpperCase() }), completed: true }) });
      } catch { /* never block (§1) */ }
      track(isNonOrganic ? "onboarding_completed" : "intent_selected", isNonOrganic ? { entry_point: entryPointProp(entry) } : { value: intent });
      setSaving(false);
    }
    window.location.href = dest;
  }

  if (!resumed) {
    return <div className="mx-auto max-w-lg px-6 py-16" aria-busy="true"><p className="text-sm text-white/60">Resuming where you left off…</p></div>;
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10 sm:py-16">
      <p className="text-xs font-medium tracking-wide text-white/50" aria-live="polite">{stepLabel()} · {STEPS[isNonOrganic && step >= 4 ? 5 : step]}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={totalSteps} aria-label="Onboarding progress">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>

      {step === 0 && (
        <section aria-labelledby="ob-username">
          <h1 id="ob-username" className="mt-6 text-2xl font-bold text-white">Choose your username</h1>
          <p className="mt-1 text-sm text-white/60">The only required step. This is your public URL: <span className="text-white/80">klyro.dev/u/{username || "you"}</span></p>
          <label htmlFor="username" className="mt-6 block text-sm font-medium text-white/80">Username</label>
          <input id="username" autoComplete="username" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white" placeholder="e.g. ama-builds"
            value={username} onChange={(e) => onUsernameChange(e.target.value)} aria-describedby="username-feedback" aria-invalid={check?.available === false} />
          <div id="username-feedback" aria-live="polite" className="mt-2 min-h-6 text-sm">
            {checking && <span className="text-white/50">Checking…</span>}
            {check?.available && <span className="text-emerald-400">Available — nice pick.</span>}
            {check && !check.available && <span className="text-rose-400">{check.reason}</span>}
            {check && !check.available && check.suggestions.length > 0 && (
              <span className="mt-1 block text-white/60">Try: {check.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => onUsernameChange(s)} className="mr-2 underline decoration-dotted underline-offset-2 hover:text-white">{s}</button>
              ))}</span>
            )}
          </div>
          <button disabled={saving || username.trim().length < 3 || check?.available === false}
            onClick={async () => {
              setSaving(true);
              const res = await fetch("/api/v1/users/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
              setSaving(false);
              if (!res.ok && res.status === 401) { setMsg("Session expired — sign in again, you'll resume here."); return; }
              track("username_set", { entry_point: entryPointProp(entry) });
              setStep(1);
            }}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-40">Continue</button>
          <p className="mt-2 text-xs text-white/40">Live-checked against availability + format rules. OAuth signups see a suggestion here — edit it, don&apos;t auto-accept a wrong pre-fill.</p>
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="ob-basics">
          <h1 id="ob-basics" className="mt-6 text-2xl font-bold text-white">Tell people who you are</h1>
          <p className="mt-1 text-sm text-white/60">Basics — visible on your public profile.</p>
          <div className="mt-6 space-y-4">
            <div><label htmlFor="displayName" className="block text-sm font-medium text-white/80">Display name</label>
              <input id="displayName" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
            <div><label htmlFor="bio" className="block text-sm font-medium text-white/80">One-line bio <span className="text-white/40">({form.bio.length}/160)</span></label>
              <input id="bio" maxLength={160} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            <div className="flex gap-3">
              <div className="flex-1"><label htmlFor="location" className="block text-sm font-medium text-white/80">Location</label>
                <input id="location" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div className="flex-1"><label htmlFor="website" className="block text-sm font-medium text-white/80">Website</label>
                <input id="website" inputMode="url" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} /></div>
            </div>
          </div>
          <button disabled={saving} onClick={async () => { if (await saveProfile(false)) { setStep(2); } }} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-40">Continue</button>
          <button disabled={saving} onClick={async () => { if (await saveProfile(true)) setStep(2); }} className="mt-2 w-full rounded-lg px-4 py-3 text-sm text-white/60 hover:text-white">Skip for now</button>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="ob-about">
          <h1 id="ob-about" className="mt-6 text-2xl font-bold text-white">A little more about you <span className="text-base font-normal text-white/40">(optional)</span></h1>
          <p className="mt-1 text-sm text-white/60">Markdown supported. This is enrichment, not a requirement.</p>
          <label htmlFor="about" className="mt-6 block text-sm font-medium text-white/80">About</label>
          <textarea id="about" rows={5} maxLength={5000} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white" placeholder="What do you love building?" value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
          <button disabled={saving} onClick={async () => { if (await saveProfile(false)) setStep(3); }} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-40">Continue</button>
          <button disabled={saving} onClick={async () => { if (await saveProfile(true)) setStep(3); }} className="mt-2 w-full rounded-lg px-4 py-3 text-sm text-white/60 hover:text-white">Skip for now</button>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="ob-skills">
          <h1 id="ob-skills" className="mt-6 text-2xl font-bold text-white">What are you good at? <span className="text-base font-normal text-white/40">(optional)</span></h1>
          <p className="mt-1 text-sm text-white/60">Powers matching &amp; discovery. Missing a skill? Propose it — new tags queue for review.</p>
          <label htmlFor="skill" className="mt-6 block text-sm font-medium text-white/80">Add a skill</label>
          <div className="mt-1 flex gap-2">
            <input id="skill" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white" placeholder="e.g. react, ui-design, copywriting" value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
            <button onClick={addSkill} className="rounded-lg border border-white/15 px-4 text-white hover:bg-white/5">Add</button>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Your skills">
            {skills.map((s) => (
              <li key={s.name} className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm text-white">
                {s.name} · {s.level.toLowerCase()}
                <button aria-label={`Remove ${s.name}`} onClick={() => setSkills(skills.filter((x) => x.name !== s.name))} className="text-white/50 hover:text-white">×</button>
              </li>
            ))}
            {skills.length === 0 && <li className="text-sm text-white/40">No skills yet — that&apos;s fine.</li>}
          </ul>
          <button disabled={saving} onClick={async () => { if (await saveProfile(skills.length === 0)) { if (isNonOrganic) finish(); else setStep(4); } }} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
            {isNonOrganic ? "Finish" : "Continue"}
          </button>
          {skills.length > 0 && <button disabled={saving} onClick={async () => { if (await saveProfile(true)) { if (isNonOrganic) finish(); else setStep(4); } }} className="mt-2 w-full rounded-lg px-4 py-3 text-sm text-white/60 hover:text-white">Skip for now</button>}
        </section>
      )}

      {step === 4 && !isNonOrganic && (
        <section aria-labelledby="ob-intent">
          <h1 id="ob-intent" className="mt-6 text-2xl font-bold text-white">What brings you to Klyro?</h1>
          <p className="mt-1 text-sm text-white/60">One question — no follow-ups here. Filters live in discovery, not onboarding.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Your intent">
            {([["start", "Start a project", "Post what you're building"], ["join", "Join one", "Find a team to help"], ["both", "Both", "Show me everything"]] as [Intent, string, string][]).map(([v, title, sub]) => (
              <button key={v} role="radio" aria-checked={intent === v} onClick={() => setIntent(v)}
                className={`rounded-xl border p-4 text-left transition ${intent === v ? "border-indigo-400 bg-indigo-600/20 text-white" : "border-white/10 bg-white/5 text-white/80 hover:border-white/25"}`}>
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-xs opacity-70">{sub}</span>
              </button>
            ))}
          </div>
          <button disabled={saving} onClick={() => finish()} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
            {saving ? "Finishing…" : "Get started"}
          </button>
        </section>
      )}

      {msg && <p className="mt-4 text-sm text-white/70" aria-live="polite">{msg}</p>}
      <p className="mt-6 text-xs text-white/40">Never blocked: every step past username is skippable and resumable. Dismissible completion nudges live on the dashboard, not here.</p>
    </div>
  );
}

function entryPointProp(e: Entry): string {
  return e === "project" ? "project_invite" : e === "group" ? "group_invite" : e;
}

function entryPointEnum(e: Entry): string {
  return e === "project" ? "PROJECT_INVITE" : e === "group" ? "GROUP_INVITE" : e.toUpperCase();
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg px-6 py-16"><p className="text-sm text-white/60">Loading…</p></div>}>
      <OnboardingWizard />
    </Suspense>
  );
}
