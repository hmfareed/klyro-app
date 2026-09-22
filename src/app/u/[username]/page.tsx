import { prisma } from "@/shared/db/prisma";
import { notFound } from "next/navigation";

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

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-white">
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
