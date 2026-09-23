import type { Metadata } from "next";
import { prisma } from "@/shared/db/prisma";
import { notFound } from "next/navigation";
import { getSessionUserId } from "@/shared/auth/session";
import { TopBar } from "@/components/workspace/TopBar";
import { UserProfileView } from "@/components/profile/UserProfileView";

// 28-SEO: SSR public profile with title/meta/OG/canonical + Person schema.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
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
    openGraph: {
      title,
      description,
      url: `${base}/u/${user.username}`,
      images: user.avatarUrl ? [user.avatarUrl] : [],
      type: "profile",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const sessionUserId = await getSessionUserId().catch(() => null);

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      about: true,
      location: true,
      websiteUrl: true,
      githubUsername: true,
      createdAt: true,
      skills: {
        include: { skill: true },
      },
      projectsOwned: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          description: true,
          category: true,
          status: true,
          visibility: true,
          techStack: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { members: true },
          },
        },
      },
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "desc" },
        select: {
          id: true,
          joinedAt: true,
          role: {
            select: {
              title: true,
              permissionLevel: true,
            },
          },
          project: {
            select: {
              id: true,
              slug: true,
              title: true,
              tagline: true,
              status: true,
              visibility: true,
              techStack: true,
              updatedAt: true,
              _count: {
                select: { members: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user) notFound();

  const isOwner = Boolean(sessionUserId && sessionUserId === user.id);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Calculate dynamic stats
  const totalRepos = (user.projectsOwned?.length || 0) + (user.memberships?.length || 0);
  const totalContributions = (user.projectsOwned?.length || 0) * 3 + (user.memberships?.length || 0) * 2;

  const profileUser = {
    ...user,
    isOwner,
    stats: {
      repositoriesCount: totalRepos,
      followersCount: 0,
      followingCount: 0,
      contributionsCount: totalContributions,
    },
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      <TopBar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: user.displayName ?? user.username,
            alternateName: user.username,
            description: user.bio ?? undefined,
            url: `${base}/u/${user.username}`,
          }),
        }}
      />
      <UserProfileView initialUser={profileUser} isOwner={isOwner} />
    </div>
  );
}
