import type { Metadata } from "next";
import { prisma } from "@/shared/db/prisma";
import { notFound } from "next/navigation";

// 28-SEO: SSR public profile with title/meta/OG/canonical + Person schema.
// Unlisted/private + suspended never index (28 §4) — Phase 0 all public.
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { username: true, displayName: true, bio: true, avatarUrl: true },
  });
  if (!user) return { title: "Not found — Klyro" };
  const title = `${user.displayName ?? user.username} (@${user.username}) — Klyro`;
  const description = user.bio ?? `Build with ${user.displayName ?? user.username} on Klyro.`;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    title,
    description,
    alternates: { canonical: `${base}/u/${user.username}` },
    openGraph: { title, description, url: `${base}/u/${user.username}`, images: user.avatarUrl ? [user.avatarUrl] : [], type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

// Public profile per 04 (Phase 0 fields). Route is /u/:username (docs concept: /@username).
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      username: true, displayName: true, avatarUrl: true, bio: true, about: true,
      location: true, websiteUrl: true, githubUsername: true, createdAt: true,
      skills: { include: { skill: true } },
    },
  });
  if (!user) notFound();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: user.displayName ?? user.username, alternateName: user.username, description: user.bio ?? undefined, url: `${base}/u/${user.username}` }) }} />
      <h1 className="text-3xl font-bold">{user.displayName ?? user.username}</h1>
      <p className="text-white/60">@{user.username}</p>
      {user.bio && <p className="mt-4">{user.bio}</p>}
      {user.about && <p className="mt-4 whitespace-pre-wrap text-white/80">{user.about}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        {user.skills.map((s) => (
          <span key={s.skillId} className="rounded-full border border-white/15 px-3 py-1 text-sm">
            {s.skill.name} · {s.level.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
