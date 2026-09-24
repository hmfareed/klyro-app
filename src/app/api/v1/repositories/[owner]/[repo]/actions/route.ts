import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getSessionUserId } from "@/shared/auth/session";
import { runGit } from "@/server/git/git-service";
import { queueActionRun, executeActionRun } from "@/server/git/actions/action-runner-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/actions — list action runs
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  let userId: string | null = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const branch = url.searchParams.get("branch");
  const event = url.searchParams.get("event");
  const status = url.searchParams.get("status");

  try {
    const where: any = { repositoryId: repository.id };
    if (branch) where.branch = branch;
    if (event) where.event = event;
    if (status) where.status = status;

    const runs = await prisma.repositoryActionRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiOk({ runs });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to load action runs", null, 500);
  }
}

const triggerRunSchema = z.object({
  workflowName: z.string().optional(),
  workflowPath: z.string().optional(),
  workflowContent: z.string().optional(),
  branch: z.string().optional(),
  async: z.boolean().default(false),
});

// POST /api/v1/repositories/[owner]/[repo]/actions — trigger a workflow run
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  let userId: string | null = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;
  if (!userId) {
    const repoOwner = await prisma.repository.findFirst({
      where: { slug: repo, owner: { username: owner } },
      select: { ownerId: true },
    });
    if (repoOwner) userId = repoOwner.ownerId;
  }

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to run workflows", null, 403);

  const body = await req.json().catch(() => ({}));
  const parsed = triggerRunSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const branch = parsed.data.branch || repository.defaultBranch || "main";
  const workflowPath = parsed.data.workflowPath;
  const workflowName = parsed.data.workflowName;
  const workflowContent = parsed.data.workflowContent;
  const isAsync = parsed.data.async;

  try {
    // Resolve commitSha for target branch
    let commitSha = "HEAD";
    try {
      const { stdout } = await runGit(repository.gitStoragePath, ["rev-parse", `refs/heads/${branch}`]);
      commitSha = stdout.trim();
    } catch {
      // Fallback to HEAD if branch ref not found
      const { stdout } = await runGit(repository.gitStoragePath, ["rev-parse", "HEAD"]);
      commitSha = stdout.trim();
    }

    const { run } = await queueActionRun({
      repositoryId: repository.id,
      commitSha,
      branch,
      event: "manual_dispatch",
      workflowPath,
      workflowName,
      workflowContent,
    });

    if (isAsync) {
      // Launch execution in background
      executeActionRun(run.id).catch((runErr) => {
        console.error(`[ActionRunner] Background error running ${run.id}:`, runErr);
      });
      return apiOk({ run }, 201);
    } else {
      // Execute synchronously
      await executeActionRun(run.id);
      const updatedRun = await prisma.repositoryActionRun.findUnique({
        where: { id: run.id },
      });
      return apiOk({ run: updatedRun }, 201);
    }
  } catch (err: any) {
    console.error("[ActionRunner] Failed to trigger workflow:", err);
    return apiError("INTERNAL_ERROR", `Failed to trigger workflow: ${err.message}`, null, 500);
  }
}
