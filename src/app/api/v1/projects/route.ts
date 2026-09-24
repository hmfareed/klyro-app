import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType, Visibility } from "@/generated/prisma";
import {
  initBareRepo,
  seedInitialCommit,
  getRepoStoragePath,
} from "@/server/git/git-service";

// GET /api/v1/projects
// If ?feed=explore -> public project discovery (status: RECRUITING or IN_PROGRESS, visibility: PUBLIC)
// Else -> authenticated user's active/owned projects
export async function GET(req: Request) {
  const url = new URL(req.url);
  const feed = url.searchParams.get("feed");
  const search = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category");
  const ipModel = url.searchParams.get("ipModel");

  if (feed === "explore") {
    const whereClause: Record<string, unknown> = {
      visibility: "PUBLIC",
    };
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { tagline: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { techStack: { has: search } },
      ];
    }
    if (category && category !== "all") {
      whereClause.category = category;
    }
    if (ipModel && ipModel !== "all") {
      whereClause.ipModel = ipModel;
    }

    try {
      const projects = await prisma.project.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          description: true,
          category: true,
          status: true,
          visibility: true,
          ipModel: true,
          openSourceLicense: true,
          techStack: true,
          commitmentLevel: true,
          createdAt: true,
          owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          roles: {
            where: { isOpen: true },
            select: { id: true, title: true, description: true, isOpen: true, permissionLevel: true },
          },
          _count: { select: { members: true, tasks: true, threads: true } },
        },
      });
      return apiOk({ success: true, data: { projects } });
    } catch {
      return apiOk({ success: true, data: { projects: [] } });
    }
  }

  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const scope = url.searchParams.get("scope") ?? "all"; // mine | shared | archived | all
  const wsSearch = url.searchParams.get("q")?.trim();
  try {
    const baseOr =
      scope === "mine"
        ? [{ ownerId: userId }]
        : scope === "shared"
          ? [{ members: { some: { userId } } }, ]
          : scope === "archived"
            ? [
                { ownerId: userId, status: { in: ["ARCHIVED", "COMPLETED"] } },
                { members: { some: { userId } }, status: { in: ["ARCHIVED", "COMPLETED"] } },
              ]
            : [{ ownerId: userId }, { members: { some: { userId } } }];
    const whereClause: Record<string, unknown> = { OR: baseOr };
    if (scope !== "archived") {
      // archived tab shows only archived/completed; other tabs hide them
      whereClause.status = { notIn: ["ARCHIVED", "COMPLETED"] };
    }
    if (wsSearch) {
      (whereClause as { AND: unknown[] }).AND = [
        {
          OR: [
            { title: { contains: wsSearch, mode: "insensitive" } },
            { tagline: { contains: wsSearch, mode: "insensitive" } },
            { description: { contains: wsSearch, mode: "insensitive" } },
          ],
        },
      ];
    }
    const projects = await prisma.project.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        tagline: true,
        status: true,
        visibility: true,
        ipModel: true,
        ownerId: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { members: true, roles: true, tasks: true, threads: true } },
      },
    });
    // Attach lightweight progress (done/total) per project for cards
    const withProgress = await Promise.all(
      projects.map(async (p) => {
        const [total, done] = await Promise.all([
          prisma.task.count({ where: { projectId: p.id } }),
          prisma.task.count({ where: { projectId: p.id, status: "DONE" } }),
        ]);
        return { ...p, progress: { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 } };
      }),
    );
    return apiOk({ success: true, data: { projects: withProgress } });
  } catch {
    return apiOk({ success: true, data: { projects: [] } });
  }
}

const roleItemSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(1000).optional(),
  permissionLevel: z.enum(["OWNER", "MAINTAINER", "CONTRIBUTOR", "VIEWER"]).default("CONTRIBUTOR"),
});

const createSchema = z.object({
  title: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers, single hyphens").optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(60).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).default("PUBLIC"),
  ipModel: z.enum(["OWNER_RETAINED", "OPEN_SOURCE", "SHARED_EQUITY", "PORTFOLIO_ONLY"]).default("PORTFOLIO_ONLY"),
  openSourceLicense: z.string().max(40).optional().nullable(),
  techStack: z.array(z.string()).default([]),
  commitmentLevel: z.string().max(50).optional(),
  roles: z.array(roleItemSchema).optional(),
});

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "project";
}

// POST /api/v1/projects — create project with optional initial roles & tech stack
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }
  const base = parsed.data.slug ?? slugify(parsed.data.title);
  let slug = base;
  for (let i = 2; i <= 10; i++) {
    const taken = await prisma.project.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${base}-${i}`;
  }
  try {
    const project = await prisma.project.create({
      data: {
        ownerId: userId,
        slug,
        title: parsed.data.title.trim(),
        tagline: parsed.data.tagline?.trim() || parsed.data.title.trim(),
        description: parsed.data.description?.trim() || parsed.data.title.trim(),
        category: parsed.data.category?.trim() || "engineering",
        visibility: parsed.data.visibility,
        ipModel: parsed.data.ipModel,
        openSourceLicense: parsed.data.openSourceLicense,
        techStack: parsed.data.techStack,
        commitmentLevel: parsed.data.commitmentLevel || "Part-time",
        roles: parsed.data.roles && parsed.data.roles.length > 0
          ? {
              create: parsed.data.roles.map((r) => ({
                title: r.title.trim(),
                description: r.description?.trim() ?? null,
                permissionLevel: r.permissionLevel,
                isOpen: true,
              })),
            }
          : undefined,
      },
      select: { id: true, slug: true, title: true },
    });

    // Automatically provision initial Git repository for the project
    try {
      const ownerUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, displayName: true, email: true },
      });

      const repo = await prisma.repository.create({
        data: {
          ownerId: userId,
          projectId: project.id,
          name: parsed.data.title.trim(),
          slug,
          description: parsed.data.description?.trim() || parsed.data.tagline?.trim() || `Repository for ${parsed.data.title.trim()}`,
          visibility: (parsed.data.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC") as Visibility,
          defaultBranch: "main",
          gitStoragePath: "",
        },
      });

      const storagePath = getRepoStoragePath(repo.id);
      await initBareRepo(storagePath, "main");
      await seedInitialCommit(storagePath, {
        defaultBranch: "main",
        files: [
          {
            path: "README.md",
            content: `# ${parsed.data.title.trim()}\n\n${parsed.data.description?.trim() || parsed.data.tagline?.trim() || "Welcome to your new repository."}\n`,
          },
        ],
        message: "Initial commit",
        author: {
          name: ownerUser?.displayName || ownerUser?.username || "Builder",
          email: ownerUser?.email || "bot@klyro.dev",
        },
      });

      await prisma.repository.update({
        where: { id: repo.id },
        data: { gitStoragePath: storagePath },
      });
    } catch (repoErr) {
      console.error("[Projects] Auto-provision repository error:", repoErr);
    }

    try {
      await prisma.analyticsEvent.create({
        data: { event: "project_created", userId, projectId: project.id },
      });
    } catch { /* analytics optional */ }

    // Centralized event emission
    await recordActivityEvent({
      actorId: userId,
      projectId: project.id,
      type: ActivityEventType.PROJECT_CREATED,
      visibility: parsed.data.visibility,
      metadata: {
        headline: "Project created",
        tagline: parsed.data.tagline?.trim() || parsed.data.title.trim(),
      },
    });

    if (parsed.data.roles && parsed.data.roles.length > 0) {
      await recordActivityEvent({
        actorId: userId,
        projectId: project.id,
        type: ActivityEventType.PROJECT_RECRUITING,
        visibility: parsed.data.visibility,
        metadata: {
          roles: parsed.data.roles.map((r) => r.title.trim()),
        },
      });
    }

    return apiOk({ success: true, data: { project } }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return apiError("SLUG_TAKEN", "That project URL is taken.", "slug", 409);
    throw err;
  }
}
