import { prisma } from "@/shared/db/prisma";
import { ActivityEventType, Visibility } from "@/generated/prisma";

export type RecordActivityEventParams = {
  actorId: string;
  projectId: string;
  type: ActivityEventType;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  visibility?: Visibility;
};

/**
 * Centralized Activity Event recording engine.
 * Every domain action across Klyro (project creation, milestone completion,
 * release publication, contributor joining) emits a normalized ActivityEvent.
 */
export async function recordActivityEvent(params: RecordActivityEventParams) {
  try {
    // If visibility is not explicitly specified, inherit from the parent project
    let visibility = params.visibility;
    if (!visibility) {
      const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        select: { visibility: true },
      });
      visibility = project?.visibility ?? Visibility.PUBLIC;
    }

    return await prisma.activityEvent.create({
      data: {
        actorId: params.actorId,
        projectId: params.projectId,
        type: params.type,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata: (params.metadata as object) ?? undefined,
        visibility,
      },
    });
  } catch (err) {
    console.error("[ActivityEngine] Failed to record event:", err);
    return null;
  }
}

/**
 * Idempotent bootstrapper: Ensures any existing project in the database
 * has an initial PROJECT_CREATED ActivityEvent so real user-created projects
 * appear immediately in the Buildstream feed without placeholder data.
 */
export async function ensureBaselineProjectEvents() {
  try {
    const projectsWithoutEvents = await prisma.project.findMany({
      where: {
        activityEvents: { none: {} },
      },
      select: {
        id: true,
        ownerId: true,
        visibility: true,
        status: true,
        createdAt: true,
        tagline: true,
        roles: { select: { id: true, title: true } },
      },
      take: 25,
    });

    for (const project of projectsWithoutEvents) {
      await prisma.activityEvent.create({
        data: {
          actorId: project.ownerId,
          projectId: project.id,
          type: ActivityEventType.PROJECT_CREATED,
          visibility: project.visibility,
          createdAt: project.createdAt,
          metadata: {
            headline: "Project created",
            tagline: project.tagline,
          },
        },
      });

      if (project.status === "RECRUITING" && project.roles.length > 0) {
        await prisma.activityEvent.create({
          data: {
            actorId: project.ownerId,
            projectId: project.id,
            type: ActivityEventType.PROJECT_RECRUITING,
            visibility: project.visibility,
            createdAt: project.createdAt,
            metadata: {
              roles: project.roles.map((r) => r.title),
            },
          },
        });
      }
    }
  } catch (err) {
    console.error("[ActivityEngine] Baseline bootstrap error:", err);
  }
}
