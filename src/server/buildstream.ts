import { prisma } from "@/shared/db/prisma";
import { ActivityEventType, Visibility } from "@/generated/prisma";
import { ensureBaselineProjectEvents } from "./events";

export type BuildstreamTab = "everything" | "following" | "my-builds" | "opportunities";
export type BuildstreamFilter = "all" | "moments" | "releases" | "opportunities" | "milestones" | "people" | "discussions";

export type FeedProjectData = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  status: string;
  techStack: string[];
  starsCount: number;
  followersCount: number;
  memberCount: number;
  openRolesCount: number;
  openRoles: Array<{ id: string; title: string }>;
  isStarredByViewer: boolean;
  isFollowedByViewer: boolean;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isCurrentUser: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type FeedItem = {
  id: string;
  type: ActivityEventType;
  kind: "launch" | "opportunity" | "release" | "milestone" | "contributor" | "update" | "discussion" | "achievement";
  time: string;
  rawCreatedAt: string;
  headline: string;
  body?: string;
  project: FeedProjectData;
  roles?: string[];
  version?: string;
  versionFrom?: string;
  milestoneTitle?: string;
  milestoneProgress?: number;
  stats?: Array<{ label: string; value: string | number }>;
  buildStory?: string[];
};

export type BuildstreamPayload = {
  items: FeedItem[];
  nextCursor: string | null;
  stats: {
    activeBuilds: number;
    updatedRecently: number;
    openOpportunities: number;
    launchesAndMoments: number;
  };
  pulse: {
    assignedTasks: number;
    pendingApplications: number;
    myBuilds: number;
    followingCount: number;
    unreadNotifications: number;
  };
  trending: Array<{
    id: string;
    slug: string;
    title: string;
    stars: number;
    memberCount: number;
    reason: string;
  }>;
  opportunities: Array<{
    id: string;
    slug: string;
    projectTitle: string;
    roleTitle: string;
    techStack: string[];
  }>;
  recommendedBuilders: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    sharedCount: number;
    skills: string[];
  }>;
  radar: Array<{
    category: string;
    count: number;
  }>;
};

function formatRelativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapTypeToKind(type: ActivityEventType): FeedItem["kind"] {
  switch (type) {
    case ActivityEventType.PROJECT_CREATED:
    case ActivityEventType.BUILD_LAUNCHED:
      return "launch";
    case ActivityEventType.PROJECT_RECRUITING:
    case ActivityEventType.PROJECT_RECRUITING_CLOSED:
    case ActivityEventType.COLLABORATOR_INVITED:
      return "opportunity";
    case ActivityEventType.RELEASE_CREATED:
      return "release";
    case ActivityEventType.MILESTONE_CREATED:
    case ActivityEventType.MILESTONE_COMPLETED:
      return "milestone";
    case ActivityEventType.MEMBER_JOINED:
    case ActivityEventType.MEMBER_LEFT:
    case ActivityEventType.CONTRIBUTOR_ADDED:
    case ActivityEventType.COLLABORATOR_ACCEPTED:
      return "contributor";
    case ActivityEventType.DISCUSSION_CREATED:
    case ActivityEventType.DISCUSSION_REPLIED:
      return "discussion";
    case ActivityEventType.POST_UPDATE:
    case ActivityEventType.PROJECT_UPDATED:
    case ActivityEventType.PROJECT_STARRED:
    case ActivityEventType.PROJECT_FOLLOWED:
    case ActivityEventType.TASK_CREATED:
    case ActivityEventType.TASK_COMPLETED:
    default:
      return "update";
  }
}

export async function getBuildstreamFeed(params: {
  userId?: string | null;
  tab?: BuildstreamTab;
  filter?: BuildstreamFilter;
  query?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const { userId, tab = "everything", filter = "all", query = "", cursor, limit = 20 } = params;

  // Ensure any existing projects in DB have their baseline events
  await ensureBaselineProjectEvents();

  // Visibility boundary: public events or private projects where user is owner/member
  const visibilityCondition: Record<string, unknown> = userId
    ? {
        OR: [
          { visibility: Visibility.PUBLIC },
          { project: { ownerId: userId } },
          { project: { members: { some: { userId, status: "ACTIVE" } } } },
        ],
      }
    : { visibility: Visibility.PUBLIC };

  // Tab filter
  const tabConditions: Record<string, unknown>[] = [];
  if (tab === "following") {
    if (!userId) return { items: [], nextCursor: null };
    tabConditions.push({
      project: { followers: { some: { userId } } },
    });
  } else if (tab === "my-builds") {
    if (!userId) return { items: [], nextCursor: null };
    tabConditions.push({
      OR: [
        { project: { ownerId: userId } },
        { project: { members: { some: { userId, status: "ACTIVE" } } } },
      ],
    });
  } else if (tab === "opportunities") {
    tabConditions.push({
      OR: [
        { type: ActivityEventType.PROJECT_RECRUITING },
        { project: { status: "RECRUITING", roles: { some: { isOpen: true } } } },
      ],
    });
  }

  // Filter pills
  const filterConditions: Record<string, unknown>[] = [];
  if (filter === "moments") {
    filterConditions.push({
      type: {
        in: [
          ActivityEventType.PROJECT_CREATED,
          ActivityEventType.BUILD_LAUNCHED,
          ActivityEventType.POST_UPDATE,
          ActivityEventType.PROJECT_UPDATED,
        ],
      },
    });
  } else if (filter === "releases") {
    filterConditions.push({ type: ActivityEventType.RELEASE_CREATED });
  } else if (filter === "opportunities") {
    filterConditions.push({
      type: { in: [ActivityEventType.PROJECT_RECRUITING, ActivityEventType.COLLABORATOR_INVITED] },
    });
  } else if (filter === "milestones") {
    filterConditions.push({
      type: { in: [ActivityEventType.MILESTONE_CREATED, ActivityEventType.MILESTONE_COMPLETED] },
    });
  } else if (filter === "people") {
    filterConditions.push({
      type: { in: [ActivityEventType.MEMBER_JOINED, ActivityEventType.CONTRIBUTOR_ADDED, ActivityEventType.COLLABORATOR_ACCEPTED] },
    });
  } else if (filter === "discussions") {
    filterConditions.push({
      type: { in: [ActivityEventType.DISCUSSION_CREATED, ActivityEventType.DISCUSSION_REPLIED] },
    });
  }

  // Search query
  const searchConditions: Record<string, unknown>[] = [];
  const q = query.trim();
  if (q) {
    searchConditions.push({
      OR: [
        { project: { title: { contains: q, mode: "insensitive" } } },
        { project: { slug: { contains: q, mode: "insensitive" } } },
        { project: { tagline: { contains: q, mode: "insensitive" } } },
        { project: { description: { contains: q, mode: "insensitive" } } },
        { project: { techStack: { has: q } } },
        { actor: { username: { contains: q, mode: "insensitive" } } },
        { actor: { displayName: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const whereClause: Record<string, unknown> = {
    AND: [visibilityCondition, ...tabConditions, ...filterConditions, ...searchConditions],
  };

  const events = await prisma.activityEvent.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      actor: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      project: {
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          roles: {
            where: { isOpen: true },
            select: { id: true, title: true },
          },
          milestones: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, status: true },
          },
          stars: userId ? { where: { userId } } : false,
          followers: userId ? { where: { userId } } : false,
          _count: {
            select: {
              members: true,
              stars: true,
              followers: true,
              roles: { where: { isOpen: true } },
              releases: true,
            },
          },
        },
      },
    },
  });

  let nextCursor: string | null = null;
  if (events.length > limit) {
    const nextItem = events.pop();
    nextCursor = nextItem?.id ?? null;
  }

  const items: FeedItem[] = events.map((ev) => {
    const p = ev.project;
    const author = p.owner;
    const isOwner = Boolean(userId && author.id === userId);
    const authorName = author.displayName || author.username;
    const meta = (ev.metadata as Record<string, unknown>) ?? {};

    const openRoles = p.roles.map((r) => ({ id: r.id, title: r.title }));
    const starsCount = p._count.stars;
    const followersCount = p._count.followers;
    const memberCount = p._count.members;
    const openRolesCount = p._count.roles;

    const kind = mapTypeToKind(ev.type);

    // Build story computed dynamically from actual milestones and creation
    const buildStory = [
      "Project created",
      ...(p.milestones.map((m) => m.title)),
      ...(p.status === "RECRUITING" ? ["Recruiting contributors"] : ["In active development"]),
    ];

    let headline = (meta.headline as string) || "";
    let body = (meta.body as string) || (meta.tagline as string) || p.tagline;

    if (ev.type === ActivityEventType.PROJECT_CREATED) {
      headline = `${authorName} started ${p.title}`;
      body = p.tagline;
    } else if (ev.type === ActivityEventType.BUILD_LAUNCHED) {
      headline = `${authorName} launched ${p.title}`;
      body = p.tagline;
    } else if (ev.type === ActivityEventType.PROJECT_RECRUITING) {
      headline = `${p.title} is looking for collaborators`;
      body = `Open roles: ${openRoles.map((r) => r.title).join(", ") || "Contributors needed"}.`;
    } else if (ev.type === ActivityEventType.RELEASE_CREATED) {
      headline = (meta.title as string) || `Release ${(meta.version as string) || "v1.0.0"} published`;
      body = (meta.description as string) || p.tagline;
    } else if (ev.type === ActivityEventType.MILESTONE_COMPLETED) {
      headline = `Milestone completed: ${(meta.milestoneTitle as string) || "Milestone"}`;
    } else if (ev.type === ActivityEventType.MEMBER_JOINED) {
      headline = `${ev.actor.displayName || ev.actor.username} joined ${p.title}`;
    } else if (ev.type === ActivityEventType.POST_UPDATE) {
      headline = (meta.title as string) || "Project update";
      body = (meta.body as string) || p.tagline;
    } else if (!headline) {
      headline = `${p.title} updated`;
    }

    return {
      id: ev.id,
      type: ev.type,
      kind,
      time: formatRelativeTime(ev.createdAt),
      rawCreatedAt: ev.createdAt.toISOString(),
      headline,
      body,
      project: {
        id: p.id,
        slug: p.slug,
        title: p.title,
        tagline: p.tagline,
        description: p.description,
        category: p.category,
        status: p.status,
        techStack: p.techStack,
        starsCount,
        followersCount,
        memberCount,
        openRolesCount,
        openRoles,
        isStarredByViewer: Array.isArray(p.stars) && p.stars.length > 0,
        isFollowedByViewer: Array.isArray(p.followers) && p.followers.length > 0,
        author: {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
          isCurrentUser: isOwner,
        },
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      },
      roles: openRoles.map((r) => r.title),
      version: (meta.version as string) || undefined,
      versionFrom: (meta.versionFrom as string) || undefined,
      milestoneTitle: (meta.milestoneTitle as string) || undefined,
      milestoneProgress: typeof meta.milestoneProgress === "number" ? meta.milestoneProgress : 100,
      stats: [
        { label: "stars", value: starsCount },
        { label: "contributors", value: memberCount },
        { label: "releases", value: p._count.releases },
      ],
      buildStory,
    };
  });

  return { items, nextCursor };
}

export async function getEcosystemStats(): Promise<BuildstreamPayload["stats"]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [activeBuilds, updatedRecently, openOpportunities, launchesAndMoments] = await Promise.all([
    prisma.project.count({
      where: {
        visibility: Visibility.PUBLIC,
        status: { in: ["RECRUITING", "IN_PROGRESS", "COMPLETED"] },
      },
    }),
    prisma.project.count({
      where: {
        visibility: Visibility.PUBLIC,
        updatedAt: { gte: twentyFourHoursAgo },
      },
    }),
    prisma.role.count({
      where: {
        isOpen: true,
        project: { visibility: Visibility.PUBLIC },
      },
    }),
    prisma.activityEvent.count({
      where: {
        visibility: Visibility.PUBLIC,
        type: {
          in: [
            ActivityEventType.BUILD_LAUNCHED,
            ActivityEventType.PROJECT_CREATED,
            ActivityEventType.RELEASE_CREATED,
            ActivityEventType.MILESTONE_COMPLETED,
            ActivityEventType.POST_UPDATE,
          ],
        },
      },
    }),
  ]);

  return {
    activeBuilds,
    updatedRecently,
    openOpportunities,
    launchesAndMoments,
  };
}

export async function getUserPulse(userId: string | null): Promise<BuildstreamPayload["pulse"]> {
  if (!userId) {
    return {
      assignedTasks: 0,
      pendingApplications: 0,
      myBuilds: 0,
      followingCount: 0,
      unreadNotifications: 0,
    };
  }

  const [assignedTasks, pendingAppsAsApplicant, pendingAppsAsOwner, myBuilds, followingCount, unreadNotifications] =
    await Promise.all([
      prisma.taskAssignee.count({
        where: {
          userId,
          task: { status: { not: "DONE" } },
        },
      }),
      prisma.application.count({
        where: { applicantId: userId, status: "PENDING" },
      }),
      prisma.application.count({
        where: { project: { ownerId: userId }, status: "PENDING" },
      }),
      prisma.project.count({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { userId, status: "ACTIVE" } } }],
        },
      }),
      prisma.projectFollower.count({
        where: { userId },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

  return {
    assignedTasks,
    pendingApplications: pendingAppsAsApplicant + pendingAppsAsOwner,
    myBuilds,
    followingCount,
    unreadNotifications,
  };
}

export async function getTrendingProjects(): Promise<BuildstreamPayload["trending"]> {
  const projects = await prisma.project.findMany({
    where: { visibility: Visibility.PUBLIC },
    take: 10,
    include: {
      _count: {
        select: {
          stars: true,
          members: true,
          activityEvents: true,
        },
      },
    },
  });

  const scored = projects.map((p) => {
    const stars = p._count.stars;
    const members = p._count.members;
    const events = p._count.activityEvents;
    const score = stars * 3 + members * 2 + events;
    const reason =
      events > 2
        ? `${events} updates recently`
        : stars > 0
        ? `${stars} star${stars === 1 ? "" : "s"}`
        : `${members} contributor${members === 1 ? "" : "s"}`;

    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      stars,
      memberCount: members,
      score,
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(({ id, slug, title, stars, memberCount, reason }) => ({
    id,
    slug,
    title,
    stars,
    memberCount,
    reason,
  }));
}

export async function getTopOpportunities(): Promise<BuildstreamPayload["opportunities"]> {
  const roles = await prisma.role.findMany({
    where: {
      isOpen: true,
      project: { visibility: Visibility.PUBLIC, status: "RECRUITING" },
    },
    take: 4,
    orderBy: { project: { updatedAt: "desc" } },
    include: {
      project: {
        select: { id: true, slug: true, title: true, techStack: true },
      },
    },
  });

  return roles.map((r) => ({
    id: r.id,
    slug: r.project.slug,
    projectTitle: r.project.title,
    roleTitle: r.title,
    techStack: r.project.techStack,
  }));
}

export async function getRecommendedBuilders(userId: string | null): Promise<BuildstreamPayload["recommendedBuilders"]> {
  // Query other users who have public projects or profiles
  const users = await prisma.user.findMany({
    where: userId ? { id: { not: userId }, status: "ACTIVE" } : { status: "ACTIVE" },
    take: 6,
    orderBy: { createdAt: "desc" },
    include: {
      projectsOwned: {
        where: { visibility: Visibility.PUBLIC },
        select: { techStack: true },
      },
      skills: {
        include: { skill: { select: { name: true } } },
      },
    },
  });

  // Extract viewer skills/stacks if logged in
  let viewerSkills: string[] = [];
  if (userId) {
    const viewer = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: { include: { skill: { select: { name: true } } } },
        projectsOwned: { select: { techStack: true } },
      },
    });
    if (viewer) {
      viewerSkills = [
        ...viewer.skills.map((s) => s.skill.name),
        ...viewer.projectsOwned.flatMap((p) => p.techStack),
      ];
    }
  }

  return users.map((u) => {
    const userSkills = [
      ...u.skills.map((s) => s.skill.name),
      ...u.projectsOwned.flatMap((p) => p.techStack),
    ];
    const uniqueSkills = Array.from(new Set(userSkills));
    const sharedCount = viewerSkills.filter((s) => uniqueSkills.includes(s)).length;

    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      sharedCount,
      skills: uniqueSkills.slice(0, 3),
    };
  });
}

export async function getBuildRadar(): Promise<BuildstreamPayload["radar"]> {
  const projects = await prisma.project.findMany({
    where: { visibility: Visibility.PUBLIC },
    select: { category: true },
  });

  const freq = new Map<string, number>();
  for (const p of projects) {
    const cat = p.category ? p.category.trim() : "Software";
    freq.set(cat, (freq.get(cat) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
