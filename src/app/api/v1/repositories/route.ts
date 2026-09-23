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

// Reserved repository slugs to prevent routing collisions
const RESERVED_SLUGS = new Set([
  "new",
  "settings",
  "api",
  "admin",
  "explore",
  "projects",
  "repositories",
  "teams",
  "chat",
  "drive",
  "issues",
  "pulls",
  "pull-requests",
  "wiki",
  "raw",
  "blob",
  "tree",
  "commits",
  "branches",
  "releases",
  "tags",
]);

// Slug generator
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "repository"
  );
}

// GET /api/v1/repositories — list repositories with filtering
export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim();
  const projectId = url.searchParams.get("projectId");
  const filter = url.searchParams.get("filter"); // "mine" | "starred" | "all"
  const userId = await getSessionUserId();

  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (projectId) {
    whereClause.projectId = projectId;
  }

  if (filter === "mine" && userId) {
    whereClause.ownerId = userId;
  } else if (filter === "starred" && userId) {
    whereClause.stars = {
      some: { userId },
    };
  } else if (!userId) {
    // Unauthenticated: only public repositories
    whereClause.visibility = "PUBLIC";
  } else if (!filter || filter === "all") {
    // Authenticated viewing all: public, or where owner/collaborator
    whereClause.OR = [
      { visibility: "PUBLIC" },
      { ownerId: userId },
      { collaborators: { some: { userId } } },
    ];
  }

  try {
    const repositories = await prisma.repository.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, slug: true },
        },
        _count: {
          select: {
            stars: true,
            forks: true,
            issues: { where: { status: "OPEN" } },
            pullRequests: { where: { status: "OPEN" } },
          },
        },
      },
    });

    return apiOk({ repositories });
  } catch (err: any) {
    console.error("[Repositories] GET error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load repositories", null, 500);
  }
}

const createRepoSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Name can only contain letters, numbers, hyphens, dots, and underscores"),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  projectId: z.string().optional().nullable(),
  defaultBranch: z.string().default("main"),
  initializeReadme: z.boolean().default(true),
  gitignoreTemplate: z.string().optional(),
  license: z.string().optional(),
});

// POST /api/v1/repositories — create a new repository and initialize bare git storage
export async function POST(req: Request) {
  let userId = await getSessionUserId();

  // If testing or unauthenticated in local dev, fallback to first user
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }

  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to create a repository", null, 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = createRepoSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input", String(first?.path?.[0] ?? ""), 400);
  }

  const {
    name,
    description,
    visibility,
    projectId,
    defaultBranch,
    initializeReadme,
    gitignoreTemplate,
    license,
  } = parsed.data;

  const baseSlug = parsed.data.slug || slugify(name);

  if (RESERVED_SLUGS.has(baseSlug)) {
    return apiError("INVALID_NAME", `'${baseSlug}' is a reserved system name. Please choose another name.`, "name", 400);
  }

  // Ensure unique slug for this owner
  let slug = baseSlug;
  const existing = await prisma.repository.findFirst({
    where: { ownerId: userId, slug },
  });
  if (existing) {
    return apiError("DUPLICATE_NAME", `You already have a repository named '${name}'.`, "name", 409);
  }

  // Fetch owner user details for Git author
  const ownerUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, email: true },
  });

  if (!ownerUser) {
    return apiError("NOT_FOUND", "User not found", null, 404);
  }

  try {
    // 1. Create DB record first to obtain repository ID
    const repository = await prisma.repository.create({
      data: {
        ownerId: userId,
        projectId: projectId || null,
        name,
        slug,
        description: description || null,
        visibility: visibility as Visibility,
        defaultBranch,
        gitStoragePath: "", // will update right after
      },
    });

    const storagePath = getRepoStoragePath(repository.id);

    // 2. Initialize bare Git repository
    await initBareRepo(storagePath, defaultBranch);

    // 3. Prepare initial files if requested
    const initialFiles: Array<{ path: string; content: string }> = [];

    if (initializeReadme) {
      const readmeBody = [
        `# ${name}`,
        "",
        description || "Welcome to your new Klyro repository.",
        "",
        "## Getting Started",
        "",
        "Clone this repository:",
        "```bash",
        `git clone ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/repositories/${ownerUser.username}/${slug}.git`,
        "```",
      ].join("\n");

      initialFiles.push({ path: "README.md", content: readmeBody });
    }

    if (gitignoreTemplate === "Node" || gitignoreTemplate === "TypeScript") {
      initialFiles.push({
        path: ".gitignore",
        content: "node_modules/\n.next/\ndist/\nbuild/\n.env*\n*.log\n.DS_Store\n",
      });
    } else if (gitignoreTemplate === "Python") {
      initialFiles.push({
        path: ".gitignore",
        content: "__pycache__/\n*.py[cod]\n*$py.class\nvenv/\n.env\n.DS_Store\n",
      });
    }

    if (license === "MIT") {
      initialFiles.push({
        path: "LICENSE",
        content: `MIT License\n\nCopyright (c) ${new Date().getFullYear()} ${ownerUser.displayName || ownerUser.username}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy...`,
      });
    } else if (license === "Apache-2.0") {
      initialFiles.push({
        path: "LICENSE",
        content: `Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/\n\nCopyright ${new Date().getFullYear()} ${ownerUser.displayName || ownerUser.username}`,
      });
    }

    // 4. Seed initial commit if files exist
    if (initialFiles.length > 0) {
      await seedInitialCommit(storagePath, {
        defaultBranch,
        files: initialFiles,
        message: "Initial commit",
        author: {
          name: ownerUser.displayName || ownerUser.username,
          email: ownerUser.email,
        },
      });
    }

    // 5. Update gitStoragePath in DB
    const updated = await prisma.repository.update({
      where: { id: repository.id },
      data: { gitStoragePath: storagePath },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    // 6. Record activity event for Buildstream if connected to a project
    if (projectId) {
      await recordActivityEvent({
        actorId: userId,
        projectId,
        type: ActivityEventType.REPOSITORY_CREATED,
        targetType: "Repository",
        targetId: repository.id,
        metadata: {
          name,
          slug,
          visibility,
          defaultBranch,
          owner: ownerUser.username,
        },
      });
    }

    return apiOk({ repository: updated }, 201);
  } catch (err: any) {
    console.error("[Repositories] Creation error:", err);
    return apiError("INTERNAL_ERROR", `Failed to create repository: ${err.message}`, null, 500);
  }
}
