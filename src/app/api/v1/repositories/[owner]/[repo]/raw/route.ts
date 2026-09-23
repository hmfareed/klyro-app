import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getRawFileBuffer } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/raw?ref=main&path=README.md
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");

  if (!filePath) {
    return new Response("Missing path", { status: 400 });
  }

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result || !result.viewer.canRead) {
    return new Response("Not found or access denied", { status: 404 });
  }

  const { repository } = result;
  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";

  try {
    const buffer = await getRawFileBuffer(repository.gitStoragePath, ref, filePath);

    // Basic MIME type detection
    let contentType = "text/plain; charset=utf-8";
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".json")) contentType = "application/json";
    else if (lower.endsWith(".html")) contentType = "text/html";
    else if (lower.endsWith(".js") || lower.endsWith(".mjs")) contentType = "application/javascript";
    else if (lower.endsWith(".ts") || lower.endsWith(".tsx")) contentType = "text/plain; charset=utf-8";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (lower.endsWith(".svg")) contentType = "image/svg+xml";
    else if (lower.endsWith(".pdf")) contentType = "application/pdf";

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filePath.split("/").pop()}"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}
