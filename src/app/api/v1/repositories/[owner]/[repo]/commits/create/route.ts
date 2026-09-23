import { z } from "zod";
import { getSessionUserId } from "@/shared/auth/session";
import { prisma } from "@/shared/db/prisma";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { apiError, apiOk } from "@/shared/api/errors";
import { createCommitOnBranch } from "@/server/git/git-service";
import { handlePostPushEvent } from "@/server/git/hooks/post-push";

interface RouteProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

const webCommitSchema = z.object({
  branch: z.string().min(1).default("main"),
  newBranch: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9/._-]+$/, "Invalid branch name")
    .optional()
    .nullable(),
  files: z
    .array(
      z.object({
        path: z.string().min(1, "File path is required"),
        content: z.string(),
      })
    )
    .default([]),
  deletedPaths: z.array(z.string()).default([]),
  message: z.string().min(1, "Commit title is required").max(300),
  description: z.string().max(3000).optional(),
});

// POST /api/v1/repositories/[owner]/[repo]/commits/create — Create Git commit directly from Web Editor
export async function POST(req: Request, { params }: RouteProps) {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to commit changes", null, 401);
  }

  const { owner, repo } = await params;
  const access = await getRepositoryWithAccess(owner, repo, userId);

  if (!access) {
    return apiError("NOT_FOUND", "Repository not found", null, 404);
  }

  const { repository, viewer } = access;

  if (repository.archived) {
    return apiError("ARCHIVED", "This repository is archived and read-only", null, 403);
  }

  if (repository.status !== "ACTIVE") {
    return apiError("INACTIVE", "Repository is pending deletion. Commits are disabled.", null, 403);
  }

  if (!viewer.canWrite) {
    return apiError("FORBIDDEN", "You do not have write permissions for this repository", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = webCommitSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid commit data", String(first?.path?.[0] ?? ""), 400);
  }

  const { branch, newBranch, files, deletedPaths, message, description } = parsed.data;

  if (files.length === 0 && deletedPaths.length === 0) {
    return apiError("NO_CHANGES", "No files were modified or deleted", null, 400);
  }

  const targetBranch = newBranch ? newBranch.trim() : branch;

  // If committing directly to an existing branch, check branch protection rules
  if (!newBranch) {
    const rules = await prisma.branchProtectionRule.findMany({
      where: { repositoryId: repository.id },
    });

    const isProtected = rules.some((r) => {
      if (r.pattern === branch) return true;
      if (r.pattern.includes("*")) {
        const regex = new RegExp(`^${r.pattern.replace(/\*/g, ".*")}$`);
        return regex.test(branch);
      }
      return false;
    });

    if (isProtected) {
      const matchingRule = rules.find((r) => r.pattern === branch || branch.match(r.pattern));
      if (matchingRule?.requirePullRequest && !viewer.canAdmin) {
        return apiError(
          "PROTECTED_BRANCH",
          `Branch '${branch}' is protected and requires changes to be made via Pull Request. Please create a new branch.`,
          "branch",
          403
        );
      }
    }
  }

  // Author information
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, username: true, email: true },
  });

  const authorName = user?.displayName || user?.username || "Klyro User";
  const authorEmail = user?.email || "developer@klyro.dev";
  const fullCommitMessage = description ? `${message}\n\n${description}` : message;

  try {
    const commitResult = await createCommitOnBranch(repository.gitStoragePath, {
      branch,
      newBranch: newBranch || undefined,
      files,
      deletedPaths,
      message: fullCommitMessage,
      author: {
        name: authorName,
        email: authorEmail,
      },
    });

    // Post-push event processing asynchronously
    handlePostPushEvent({
      repositoryId: repository.id,
      storagePath: repository.gitStoragePath,
      actorId: userId,
      refUpdates: [
        {
          oldSha: commitResult.parentSha,
          newSha: commitResult.commitSha,
          refName: `refs/heads/${commitResult.targetBranch}`,
        },
      ],
    }).catch((err) => console.error("[WebCommit] Post event error:", err));

    return apiOk(
      {
        commitSha: commitResult.commitSha,
        branch: commitResult.targetBranch,
        isNewBranch: Boolean(newBranch),
      },
      201
    );
  } catch (err: any) {
    console.error("[WebCommit] Commit creation error:", err);
    return apiError("INTERNAL_ERROR", `Failed to commit changes: ${err.message}`, null, 500);
  }
}
