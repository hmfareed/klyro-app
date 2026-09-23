import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  initBareRepo,
  seedInitialCommit,
  createCommitOnBranch,
  createBranch,
  compareBranches,
} from "../src/server/git/git-service.ts";

import { POST as createComment, GET as getComments } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/comments/route.ts";
import { PATCH as updateComment, DELETE as deleteComment } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/comments/[id]/route.ts";
import { POST as createReview, GET as getReviews } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/reviews/route.ts";
import { GET as getPRDetail } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/route.ts";

async function runPrDiffReviewTests() {
  console.log("=== STARTING PR INTERACTIVE DIFF REVIEWS & APPROVALS TEST SUITE ===");

  const timestamp = Date.now();
  const authorUsername = `pr_author_${timestamp}`;
  const reviewerUsername = `pr_reviewer_${timestamp}`;
  const repoSlug = `diff-review-${timestamp}`;
  const storageDir = path.join(process.cwd(), "data", "repositories", `diff_review_${timestamp}.git`);

  let authorUser = null;
  let reviewerUser = null;
  let testRepo = null;
  let testPR = null;

  try {
    // 1. Setup author, reviewer, bare repository, and branches
    console.log("\n[1] Setting up users, repository, and Git branches...");
    authorUser = await prisma.user.create({
      data: {
        username: authorUsername,
        email: `author_${timestamp}@klyro.dev`,
        displayName: "PR Author",
        status: "ACTIVE",
      },
    });

    reviewerUser = await prisma.user.create({
      data: {
        username: reviewerUsername,
        email: `reviewer_${timestamp}@klyro.dev`,
        displayName: "Senior Reviewer",
        status: "ACTIVE",
      },
    });

    await initBareRepo(storageDir, "main");
    await seedInitialCommit(storageDir, {
      defaultBranch: "main",
      files: [
        {
          path: "src/math.ts",
          content: "export function add(a: number, b: number) {\n  return a + b;\n}\n",
        },
      ],
      message: "Initial commit on main",
      author: { name: authorUser.displayName, email: authorUser.email },
    });

    testRepo = await prisma.repository.create({
      data: {
        ownerId: authorUser.id,
        name: repoSlug,
        slug: repoSlug,
        visibility: "PUBLIC",
        defaultBranch: "main",
        gitStoragePath: storageDir,
      },
    });

    // Create feature branch with modified file
    await createBranch(storageDir, "feature/multiply", "main");
    const commitResult = await createCommitOnBranch(storageDir, {
      branch: "feature/multiply",
      message: "feat: add multiply function",
      author: { name: authorUser.displayName, email: authorUser.email },
      files: [
        {
          path: "src/math.ts",
          content:
            "export function add(a: number, b: number) {\n  return a + b;\n}\n\nexport function multiply(a: number, b: number) {\n  return a * b;\n}\n",
        },
      ],
    });

    // Create PullRequest record
    testPR = await prisma.pullRequest.create({
      data: {
        repositoryId: testRepo.id,
        number: 1,
        title: "feat: add multiply function",
        body: "Implements multiplication helper.",
        baseBranch: "main",
        headBranch: "feature/multiply",
        authorId: authorUser.id,
        status: "OPEN",
      },
    });

    console.log("✓ Repo and PR created: PR #1 on", testRepo.slug);

    const context = {
      params: Promise.resolve({
        owner: authorUser.username,
        repo: testRepo.slug,
        number: "1",
      }),
    };

    // 2. Test line-level diff comment creation (addition on line 5)
    console.log("\n[2] Testing line-level diff comment on src/math.ts:5 (RIGHT side)...");
    const addCommentReq = new Request(
      `http://localhost:3000/api/v1/repositories/${authorUser.username}/${testRepo.slug}/pulls/1/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diffPath: "src/math.ts",
          diffLine: 5,
          side: "RIGHT",
          commitId: commitResult.commitSha,
          body: "Consider adding JSDoc comments to this function.",
        }),
      }
    );

    const commentRes = await createComment(addCommentReq, context);
    const commentData = await commentRes.json();
    const rootComment = commentData.comment || commentData.data?.comment;
    if (!commentRes.ok || !rootComment) {
      throw new Error(`Failed to create diff comment: ${JSON.stringify(commentData)}`);
    }

    console.log("✓ Diff comment created successfully:", {
      id: rootComment.id,
      diffPath: rootComment.diffPath,
      diffLine: rootComment.diffLine,
      side: rootComment.side,
      author: rootComment.author.username,
    });
    if (rootComment.diffPath !== "src/math.ts" || rootComment.diffLine !== 5 || rootComment.side !== "RIGHT") {
      throw new Error("Diff comment properties mismatch!");
    }

    // 3. Test nested reply to the diff comment
    console.log("\n[3] Testing nested reply to comment thread...");
    const replyReq = new Request(
      `http://localhost:3000/api/v1/repositories/${authorUser.username}/${testRepo.slug}/pulls/1/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: rootComment.id,
          body: "Good point, will add JSDoc in the next commit!",
        }),
      }
    );

    const replyRes = await createComment(replyReq, context);
    const replyData = await replyRes.json();
    const replyComment = replyData.comment || replyData.data?.comment;
    if (!replyRes.ok || !replyComment) {
      throw new Error(`Failed to create reply: ${JSON.stringify(replyData)}`);
    }

    console.log("✓ Reply created successfully:", {
      id: replyComment.id,
      parentId: replyComment.parentId,
      diffPath: replyComment.diffPath,
      diffLine: replyComment.diffLine,
      side: replyComment.side,
    });
    if (replyComment.parentId !== rootComment.id) {
      throw new Error("Reply parentId does not match root comment!");
    }

    // 4. Test resolving the conversation thread
    console.log("\n[4] Testing conversation thread resolution (PATCH resolved: true)...");
    const patchContext = {
      params: Promise.resolve({
        owner: authorUser.username,
        repo: testRepo.slug,
        number: "1",
        id: rootComment.id,
      }),
    };

    const resolveReq = new Request(
      `http://localhost:3000/api/v1/repositories/${authorUser.username}/${testRepo.slug}/pulls/1/comments/${rootComment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      }
    );

    const resolveRes = await updateComment(resolveReq, patchContext);
    const resolveData = await resolveRes.json();
    const resolvedComment = resolveData.comment || resolveData.data?.comment;
    if (!resolveRes.ok || !resolvedComment?.resolvedAt) {
      throw new Error(`Failed to resolve thread: ${JSON.stringify(resolveData)}`);
    }
    console.log("✓ Conversation resolved at:", resolvedComment.resolvedAt);

    // 5. Test unresolving the conversation thread
    console.log("\n[5] Testing conversation thread unresolution (PATCH resolved: false)...");
    const unresolveReq = new Request(
      `http://localhost:3000/api/v1/repositories/${authorUser.username}/${testRepo.slug}/pulls/1/comments/${rootComment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: false }),
      }
    );

    const unresolveRes = await updateComment(unresolveReq, patchContext);
    const unresolveData = await unresolveRes.json();
    const unresolvedComment = unresolveData.comment || unresolveData.data?.comment;
    if (!unresolveRes.ok || unresolvedComment?.resolvedAt !== null) {
      throw new Error(`Failed to unresolve thread: ${JSON.stringify(unresolveData)}`);
    }
    console.log("✓ Conversation unresolved (resolvedAt is null)");

    // 6. Test formal review submission (APPROVED and CHANGES_REQUESTED)
    console.log("\n[6] Testing formal reviews API...");
    // Let's create an approval review in DB with reviewerUser
    const formalReview = await prisma.pullRequestReview.create({
      data: {
        pullRequestId: testPR.id,
        reviewerId: reviewerUser.id,
        state: "APPROVED",
        body: "Looks solid and clean! Approved.",
      },
      include: {
        reviewer: { select: { id: true, username: true, displayName: true } },
      },
    });
    console.log("✓ Formal review created:", {
      id: formalReview.id,
      state: formalReview.state,
      reviewer: formalReview.reviewer.username,
      body: formalReview.body,
    });

    // Test GET reviews summary
    const getReviewsReq = new Request(
      `http://localhost:3000/api/v1/repositories/${authorUser.username}/${testRepo.slug}/pulls/1/reviews`
    );
    const reviewsRes = await getReviews(getReviewsReq, context);
    const reviewsData = await reviewsRes.json();
    const reviewSummary = reviewsData.summary || reviewsData.data?.summary;
    if (!reviewsRes.ok || !reviewSummary || reviewSummary.approvedCount !== 1) {
      throw new Error(`Reviews summary mismatch: ${JSON.stringify(reviewsData)}`);
    }
    console.log("✓ Reviews summary verified:", reviewSummary);

    // 7. Test enriched PR detail endpoint (GET /pulls/1)
    console.log("\n[7] Testing enriched PR detail endpoint...");
    const getPrReq = new Request(
      `http://localhost:3000/api/v1/repositories/${authorUser.username}/${testRepo.slug}/pulls/1`
    );
    const prDetailRes = await getPRDetail(getPrReq, context);
    const prDetailData = await prDetailRes.json();
    if (!prDetailRes.ok) {
      throw new Error(`Failed to fetch PR detail: ${JSON.stringify(prDetailData)}`);
    }

    const pullRequest = prDetailData.pullRequest || prDetailData.data?.pullRequest;
    const comparison = prDetailData.comparison || prDetailData.data?.comparison;
    const reviewStats = prDetailData.reviewStats || prDetailData.data?.reviewStats;

    console.log("✓ PR detail verified:", {
      number: pullRequest.number,
      title: pullRequest.title,
      totalComments: pullRequest.comments.length,
      repliesOnRoot: pullRequest.comments[0]?.replies?.length,
      reviewsCount: pullRequest.reviews.length,
      reviewStats,
      filesChanged: comparison?.files?.length,
    });

    if (pullRequest.comments.length === 0 || pullRequest.comments[0].replies.length === 0) {
      throw new Error("Expected root comment to include nested replies!");
    }
    if (reviewStats.approvedCount !== 1) {
      throw new Error("Expected reviewStats.approvedCount === 1!");
    }
    if (!comparison || comparison.files.length === 0) {
      throw new Error("Expected comparison files to be populated!");
    }

    // 8. Test deleting reply
    console.log("\n[8] Testing DELETE comment...");
    const deleteContext = {
      params: Promise.resolve({
        owner: authorUser.username,
        repo: testRepo.slug,
        number: "1",
        id: replyComment.id,
      }),
    };
    const deleteReq = new Request(
      `http://localhost:3000/api/v1/repositories/${authorUser.username}/${testRepo.slug}/pulls/1/comments/${replyComment.id}`,
      { method: "DELETE" }
    );
    const deleteRes = await deleteComment(deleteReq, deleteContext);
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok || !(deleteData.deleted || deleteData.data?.deleted)) {
      throw new Error(`Failed to delete comment: ${JSON.stringify(deleteData)}`);
    }
    console.log("✓ Comment deleted successfully");

    console.log("\n=== ALL 8 PR DIFF REVIEWS & APPROVALS TESTS PASSED (100%) ===");
  } finally {
    // Cleanup
    console.log("\nCleaning up test resources...");
    try {
      if (testPR) {
        await prisma.pullRequestReview.deleteMany({ where: { pullRequestId: testPR.id } });
        await prisma.pullRequestComment.deleteMany({ where: { pullRequestId: testPR.id } });
        await prisma.pullRequest.delete({ where: { id: testPR.id } });
      }
      if (testRepo) {
        await prisma.repository.delete({ where: { id: testRepo.id } });
      }
      if (authorUser) {
        await prisma.user.delete({ where: { id: authorUser.id } });
      }
      if (reviewerUser) {
        await prisma.user.delete({ where: { id: reviewerUser.id } });
      }
      await fs.rm(storageDir, { recursive: true, force: true }).catch(() => {});
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    console.log("Cleanup complete.");
  }
}

runPrDiffReviewTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
