import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getBranches, initBareRepo, seedInitialCommit, getRepoStoragePath } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string }> };

// GET /api/v1/repositories/[owner] — resolve repository by direct slug, ID, or project slug
export async function GET(req: Request, context: RouteContext) {
  const { owner } = await context.params;

  // 1. Try resolving repository directly by slug or ID
  let result = await getRepositoryWithAccess(owner);

  // 2. If not found directly, check if this is a project slug
  if (!result) {
    const project = await prisma.project.findFirst({
      where: {
        OR: [{ slug: owner }, { id: owner }],
      },
      include: {
        owner: true,
        repositories: {
          take: 1,
          include: {
            owner: true,
          },
        },
      },
    });

    if (project) {
      if (project.repositories.length > 0) {
        const repo = project.repositories[0];
        result = await getRepositoryWithAccess(repo.owner.username, repo.slug);
      } else {
        // Auto-provision initial repository for this project
        try {
          const newRepo = await prisma.repository.create({
            data: {
              ownerId: project.ownerId,
              projectId: project.id,
              name: project.title,
              slug: project.slug,
              description: project.description || project.tagline || `Repository for ${project.title}`,
              visibility: (project.visibility as any) || "PUBLIC",
              defaultBranch: "main",
              gitStoragePath: "",
            },
          });

          const storagePath = getRepoStoragePath(newRepo.id);
          await initBareRepo(storagePath, "main");

          await seedInitialCommit(storagePath, {
            defaultBranch: "main",
            files: [
              {
                path: "README.md",
                content: `# ${project.title}\n\n${project.description || "Welcome to your new repository."}\n`,
              },
            ],
            message: "Initial commit",
            author: {
              name: project.owner.displayName || project.owner.username,
              email: project.owner.email || "bot@klyro.dev",
            },
          });

          await prisma.repository.update({
            where: { id: newRepo.id },
            data: { gitStoragePath: storagePath },
          });

          result = await getRepositoryWithAccess(project.owner.username, newRepo.slug);
        } catch (err) {
          console.error("[Repositories] Failed to auto-provision project repository:", err);
        }
      }
    }
  }

  if (!result) {
    return apiError("NOT_FOUND", "Repository not found", null, 404);
  }

  const { repository, viewer } = result;

  if (!viewer.canRead) {
    return apiError("NOT_FOUND", "Repository not found", null, 404);
  }

  let branches: any[] = [];
  try {
    branches = await getBranches(repository.gitStoragePath, repository.defaultBranch);
  } catch {}

  return apiOk({
    repository: {
      ...repository,
      branches,
    },
    viewer,
  });
}
