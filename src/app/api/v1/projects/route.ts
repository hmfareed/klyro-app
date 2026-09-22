import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects — functional workspace list: owned + member projects.
// New users get [] (empty workspace), never someone else's seeded data.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const projects = await prisma.project.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, slug: true, title: true, tagline: true, status: true,
      visibility: true, updatedAt: true, createdAt: true,
      _count: { select: { members: true, roles: true } },
    },
  });
  return apiOk({ projects });
}

const createSchema = z.object({
  title: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers, single hyphens").optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(60).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).default("PRIVATE"),
  ipModel: z.enum(["OWNER_RETAINED", "OPEN_SOURCE", "SHARED_EQUITY", "PORTFOLIO_ONLY"]).default("PORTFOLIO_ONLY"),
});

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "project";
}

// POST /api/v1/projects — create first project (functional empty-workspace CTA).
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
        category: parsed.data.category?.trim() || "general",
        visibility: parsed.data.visibility,
        ipModel: parsed.data.ipModel,
      },
      select: { id: true, slug: true, title: true },
    });
    try {
      await (prisma as unknown as { analyticsEvent: { create: (a: unknown) => Promise<unknown> } }).analyticsEvent.create({
        data: { event: "project_created", userId, projectId: project.id },
      });
    } catch { /* analytics optional */ }
    return apiOk({ project }, 201);
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return apiError("SLUG_TAKEN", "That project URL is taken.", "slug", 409);
    throw err;
  }
}
