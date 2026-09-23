import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

type RouteContext = { params: Promise<{ owner: string; repo: string; id: string }> };

// POST /api/v1/repositories/[owner]/[repo]/webhooks/[id]/ping
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, id: webhookId } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin) return apiError("FORBIDDEN", "Admin required", null, 403);

  const webhook = await prisma.repositoryWebhook.findFirst({
    where: { id: webhookId, repositoryId: repository.id },
  });
  if (!webhook) return apiError("NOT_FOUND", "Webhook not found", null, 404);

  try {
    await dispatchRepositoryWebhooks({
      repositoryId: repository.id,
      event: "ping",
      payload: {
        zen: "Code collaboratively, build publicly.",
        hook_id: webhook.id,
        repository: {
          id: repository.id,
          name: repository.name,
          slug: repository.slug,
        },
      },
    });

    return apiOk({ success: true, message: "Ping event dispatched" });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to dispatch ping", null, 500);
  }
}
