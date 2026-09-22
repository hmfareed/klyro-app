export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a1128] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-black">K</span>
          <span className="text-lg font-bold">Klyro</span>
        </div>
        <nav className="flex gap-3 text-sm">
          <a href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500">Get started</a>
          <a href="/login" className="rounded-lg border border-white/15 px-4 py-2 hover:bg-white/5">Sign in</a>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        <p className="text-sm uppercase tracking-widest text-indigo-300">Phase 0 — Foundation live</p>
        <h1 className="text-4xl font-bold leading-tight">
          Instead of &ldquo;I need a job&rdquo;, it becomes &ldquo;I need people to build something with.&rdquo;
        </h1>
        <p className="text-white/70">
          Post a project, recruit by role, run the lifecycle in one place, and walk away with a
          verified contribution record. Auth + base profiles are live; projects &amp; teams (Phase 1) come next.
        </p>
        <div className="flex gap-3">
          <a href="/signup" className="rounded-lg bg-indigo-600 px-5 py-3 font-medium hover:bg-indigo-500">Create account</a>
          <a href="/repositories/school-management-system" className="rounded-lg border border-white/15 px-5 py-3 hover:bg-white/5">View workspace UI</a>
        </div>
        <ol className="mt-4 space-y-2 text-sm text-white/60">
          <li>1. <code>POST /api/v1/auth/signup</code> — email, password (10+ chars), username</li>
          <li>2. <code>GET /api/v1/auth/verify?token=…</code> — from console log / Mailhog :8025</li>
          <li>3. <code>PATCH /api/v1/users/me</code> — displayName, bio, about, skills</li>
          <li>4. <code>GET /api/v1/users/:username</code> — public profile</li>
        </ol>
      </main>
    </div>
  );
}
