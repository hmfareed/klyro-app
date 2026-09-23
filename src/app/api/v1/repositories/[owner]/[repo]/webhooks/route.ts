import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/webhooks
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin) return apiError("FORBIDDEN", "Admin required", null, 403);

  try {
    const webhooks = await prisma.repositoryWebhook.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    return apiOk({ webhooks });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to load webhooks", null, 500);
  }
}

const createWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  secret: z.string().optional(),
  events: z.array(z.string()).default(["push", "pull_request", "issues", "release"]),
});

// POST /api/v1/repositories/[owner]/[repo]/webhooks
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin) return apiError("FORBIDDEN", "Admin required", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { url, secret, events } = parsed.data;

  try {
    const webhook = await prisma.repositoryWebhook.create({
      data: {
        repositoryId: repository.id,
        url,
        secret: secret || null,
        events,
      },
    });

    return apiOk({ webhook }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to create webhook", null, 500);
  }
}
