import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { scanRepoForSecrets } from "@/server/repositories/secret-scanner";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// POST /api/v1/repositories/[owner]/[repo]/secret-scan — run pre-flight secret scan
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin) {
    return apiError("FORBIDDEN", "Admin permissions required to scan repository", null, 403);
  }

  const url = new URL(req.url);
  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";

  try {
    const scanResult = await scanRepoForSecrets(repository.gitStoragePath, ref);
    return apiOk({
      hasWarnings: scanResult.hasWarnings,
      findings: scanResult.findings,
      totalFilesScanned: scanResult.totalFilesScanned,
    });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to run secret scan: ${err.message}`, null, 500);
  }
}
