import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { createNotification } from "@/shared/notifications/create";
import { apiError, apiOk } from "@/shared/api/errors";

const applySchema = z.object({
  roleId: z.string().min(1),
  message: z.string().min(10, "Please provide a pitch of at least 10 characters.").max(3000),
});

// POST /api/v1/projects/:slug/apply — apply to an open role
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "You must sign in to apply to a project.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      owner: { select: { id: true, username: true } },
      members: { select: { userId: true } },
    },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  if (project.ownerId === userId || project.members.some((m) => m.userId === userId)) {
    return apiError("ALREADY_MEMBER", "You are already a member of this project.", null, 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid application.", String(first?.path?.[0] ?? ""), 400);
  }

  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, projectId: project.id, isOpen: true },
  });
  if (!role) return apiError("ROLE_UNAVAILABLE", "This role is not open for applications.", null, 404);

  // Check if applicant already applied
  const existing = await prisma.application.findFirst({
    where: {
      projectId: project.id,
      applicantId: userId,
      status: "PENDING",
    },
  });
  if (existing) {
    return apiError("DUPLICATE_APPLICATION", "You already have a pending application for this project.", null, 409);
  }

  const application = await prisma.application.create({
    data: {
      projectId: project.id,
      roleId: role.id,
      applicantId: userId,
      message: parsed.data.message.trim(),
      status: "PENDING",
    },
    include: {
      role: { select: { title: true } },
      applicant: { select: { username: true, displayName: true } },
    },
  });

  // Notify project owner
  await createNotification({
    userId: project.ownerId,
    type: "APPLICATION_RECEIVED",
    title: `New application for ${role.title}`,
    body: `${application.applicant.displayName || application.applicant.username} applied to join ${project.title}.`,
    linkUrl: `/projects/${project.slug}/applications`,
  });

  return apiOk({ application }, 201);
}
