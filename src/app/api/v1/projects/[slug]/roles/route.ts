import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { apiError, apiOk } from "@/shared/api/errors";

const createRoleSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(1000).optional(),
  permissionLevel: z.enum(["OWNER", "MAINTAINER", "CONTRIBUTOR", "VIEWER"]).default("CONTRIBUTOR"),
});

// POST /api/v1/projects/:slug/roles — add an open role to a project
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canManage = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canManage) return apiError("FORBIDDEN", "Only project maintainers or owners can add roles.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }

  const role = await prisma.role.create({
    data: {
      projectId: project.id,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ?? null,
      permissionLevel: parsed.data.permissionLevel,
      isOpen: true,
    },
  });

  return apiOk({ role }, 201);
}
