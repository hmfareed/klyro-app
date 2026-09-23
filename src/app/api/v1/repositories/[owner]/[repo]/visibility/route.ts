import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { changeRepositoryVisibility } from "@/server/repositories/repo-lifecycle";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

const visibilitySchema = z.object({
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  forceWithWarnings: z.boolean().default(false),
});

// POST / PATCH /api/v1/repositories/[owner]/[repo]/visibility
export async function POST(req: Request, context: RouteContext) {
  return handleVisibilityChange(req, context);
}

export async function PATCH(req: Request, context: RouteContext) {
  return handleVisibilityChange(req, context);
}

async function handleVisibilityChange(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin || !viewer.userId) {
    return apiError("FORBIDDEN", "Admin permissions required to modify visibility", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = visibilitySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const changeResult = await changeRepositoryVisibility({
    repository,
    actorId: viewer.userId,
    newVisibility: parsed.data.visibility,
    forceWithWarnings: parsed.data.forceWithWarnings,
    req,
  });

  if (!changeResult.success) {
    if ("findings" in changeResult) {
      return NextResponse.json(
        {
          error: {
            code: "SECRETS_DETECTED",
            message: "Potential secrets detected in repository files. Review findings before making repository public.",
            details: changeResult.findings,
          },
        },
        { status: 422 }
      );
    }
    const errorMsg = "message" in changeResult ? changeResult.message : "Failed to change visibility";
    return apiError("ERROR", errorMsg, null, 400);
  }

  return apiOk({ repository: changeResult.repository });
}
