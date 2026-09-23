import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { generateZipArchive } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/archive-zip?ref=main
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result || !result.viewer.canRead) {
    return new Response("Not found or access denied", { status: 404 });
  }

  const { repository } = result;
  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";

  try {
    const zipBuffer = await generateZipArchive(repository.gitStoragePath, ref);

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${repository.name}-${ref}.zip"`,
      },
    });
  } catch (err: any) {
    return new Response("Failed to generate archive", { status: 500 });
  }
}
