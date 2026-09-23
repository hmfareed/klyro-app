import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { createNotification } from "@/shared/notifications/create";
import { apiError, apiOk } from "@/shared/api/errors";

const decideSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"]),
});

// POST /api/v1/projects/:slug/applications/:id/decide — accept or reject applicant
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug, id } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canManage = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canManage) return apiError("FORBIDDEN", "Only project maintainers or owners can decide on applications.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Action must be ACCEPT or REJECT.", null, 400);
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!application || application.projectId !== project.id) {
    return apiError("NOT_FOUND", "Application not found.", null, 404);
  }

  if (application.status !== "PENDING") {
    return apiError("ALREADY_DECIDED", `This application is already ${application.status.toLowerCase()}.`, null, 400);
  }

  if (parsed.data.action === "ACCEPT") {
    // 1. Update application
    await prisma.application.update({
      where: { id },
      data: { status: "ACCEPTED", decidedAt: new Date() },
    });

    // 2. Create or restore TeamMember
    await prisma.teamMember.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: application.applicantId,
        },
      },
      update: {
        roleId: application.roleId,
        status: "ACTIVE",
      },
      create: {
        projectId: project.id,
        userId: application.applicantId,
        roleId: application.roleId,
        status: "ACTIVE",
      },
    });

    // 3. Notify applicant
    await createNotification({
      userId: application.applicantId,
      type: "APPLICATION_DECIDED",
      title: `Welcome to ${project.title}!`,
      body: `Your application for ${application.role.title} was accepted. You are now an active team member!`,
      linkUrl: `/repositories/${project.slug}`,
    });

    return apiOk({ status: "ACCEPTED", message: "Applicant accepted and added to the team roster." });
  } else {
    await prisma.application.update({
      where: { id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });

    await createNotification({
      userId: application.applicantId,
      type: "APPLICATION_DECIDED",
      title: `Application update: ${project.title}`,
      body: `Thank you for your interest in ${project.title}. The team has decided to pursue other applicants for this role.`,
      linkUrl: `/projects/${project.slug}`,
    });

    return apiOk({ status: "REJECTED", message: "Application rejected." });
  }
}
