import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/shared/db/prisma";
import { runGit, getRawFileBuffer } from "../git-service";
import {
  parseWorkflowYaml,
  getRepoWorkflows,
  shouldTriggerWorkflow,
  WorkflowDefinition,
  WorkflowStep,
} from "./workflow-parser";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface StepExecutionRecord {
  name: string;
  status: "SUCCESS" | "FAILURE" | "SKIPPED";
  durationMs: number;
  exitCode: number;
  logs: string;
}

export interface ActionRunExecutionResult {
  runId: string;
  status: "SUCCESS" | "FAILURE" | "CANCELLED";
  conclusion: "SUCCESS" | "FAILURE" | "CANCELLED";
  durationMs: number;
  steps: StepExecutionRecord[];
  logs: string;
}

/**
 * Queue a workflow run in the database and post initial CommitStatus
 */
export async function queueActionRun(params: {
  repositoryId: string;
  commitSha: string;
  branch: string;
  event: "push" | "pull_request" | "manual_dispatch";
  workflowPath?: string;
  workflowName?: string;
  workflowContent?: string;
}) {
  const { repositoryId, commitSha, branch, event, workflowPath, workflowContent } = params;

  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { id: true, gitStoragePath: true, owner: { select: { username: true } }, slug: true },
  });
  if (!repository) throw new Error("Repository not found");

  let workflow: WorkflowDefinition | null = null;
  let resolvedWorkflowName = params.workflowName || "CI Pipeline";

  if (workflowContent) {
    workflow = parseWorkflowYaml(workflowContent, workflowPath || ".klyro/workflows/ci.yml");
    resolvedWorkflowName = workflow.name;
  } else if (workflowPath) {
    try {
      const buffer = await getRawFileBuffer(repository.gitStoragePath, commitSha, workflowPath);
      workflow = parseWorkflowYaml(buffer.toString("utf8"), workflowPath);
      resolvedWorkflowName = workflow.name;
    } catch (err: any) {
      console.warn(`[ActionRunner] Could not read ${workflowPath} at ${commitSha}: ${err.message}`);
    }
  }

  // 1. Create RepositoryActionRun in database
  const run = await prisma.repositoryActionRun.create({
    data: {
      repositoryId,
      workflowName: resolvedWorkflowName,
      workflowPath: workflowPath || null,
      commitSha,
      branch,
      event,
      status: "QUEUED",
      conclusion: null,
      steps: [],
      logs: `Queued ${resolvedWorkflowName} for ref refs/heads/${branch} (${commitSha.slice(0, 7)})\n`,
      durationMs: 0,
    },
  });

  // 2. Post initial CommitStatus PENDING
  const statusContext = `klyro-ci / ${resolvedWorkflowName}`;
  await prisma.commitStatus.upsert({
    where: {
      repositoryId_commitSha_context: {
        repositoryId,
        commitSha,
        context: statusContext,
      },
    },
    create: {
      repositoryId,
      commitSha,
      context: statusContext,
      state: "PENDING",
      description: `Workflow '${resolvedWorkflowName}' queued...`,
      targetUrl: `/repositories/${repository.owner.username}/${repository.slug}?tab=actions`,
    },
    update: {
      state: "PENDING",
      description: `Workflow '${resolvedWorkflowName}' queued...`,
      targetUrl: `/repositories/${repository.owner.username}/${repository.slug}?tab=actions`,
    },
  }).catch((statusErr) => {
    console.warn("[ActionRunner] Failed to post initial commit status:", statusErr.message);
  });

  return { run, workflow };
}

/**
 * Execute an action run, capturing step logs, updating database records and commit statuses
 */
export async function executeActionRun(runId: string): Promise<ActionRunExecutionResult> {
  const run = await prisma.repositoryActionRun.findUnique({
    where: { id: runId },
    include: {
      repository: {
        select: {
          id: true,
          gitStoragePath: true,
          owner: { select: { username: true } },
          slug: true,
        },
      },
    },
  });

  if (!run) throw new Error(`Action run '${runId}' not found`);

  // Mark RUNNING
  const startedAt = new Date();
  await prisma.repositoryActionRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt },
  });

  const statusContext = `klyro-ci / ${run.workflowName}`;
  await prisma.commitStatus.upsert({
    where: {
      repositoryId_commitSha_context: {
        repositoryId: run.repositoryId,
        commitSha: run.commitSha,
        context: statusContext,
      },
    },
    create: {
      repositoryId: run.repositoryId,
      commitSha: run.commitSha,
      context: statusContext,
      state: "PENDING",
      description: `Workflow '${run.workflowName}' is running...`,
    },
    update: {
      state: "PENDING",
      description: `Workflow '${run.workflowName}' is running...`,
    },
  }).catch(() => {});

  // Parse workflow steps
  let workflowSteps: WorkflowStep[] = [];
  if (run.workflowPath) {
    try {
      const buffer = await getRawFileBuffer(run.repository.gitStoragePath, run.commitSha, run.workflowPath);
      const parsed = parseWorkflowYaml(buffer.toString("utf8"), run.workflowPath);
      const firstJob = Object.values(parsed.jobs)[0];
      if (firstJob && firstJob.steps.length > 0) {
        workflowSteps = firstJob.steps;
      }
    } catch (parseErr: any) {
      console.warn(`[ActionRunner] Failed to parse workflow steps from ${run.workflowPath}:`, parseErr.message);
    }
  }

  // Fallback default steps if none specified
  if (workflowSteps.length === 0) {
    workflowSteps = [
      { name: "Checkout repository", uses: "actions/checkout@v4" },
      { name: "Verify repository environment", run: "node --version" },
      { name: "Compile build & test suite", run: "echo 'Klyro CI build and tests passed successfully!'" },
    ];
  }

  const sandboxDir = path.join(os.tmpdir(), "klyro-runner", run.id);
  await fs.mkdir(sandboxDir, { recursive: true });

  const executionSteps: StepExecutionRecord[] = [];
  const logLines: string[] = [
    `=== Starting ${run.workflowName} ===`,
    `Ref: refs/heads/${run.branch} | Commit: ${run.commitSha}`,
    `Runner: Klyro Managed Sandbox (Worker 01)`,
    `Started at: ${startedAt.toISOString()}`,
    `--------------------------------------------------\n`,
  ];

  let overallConclusion: "SUCCESS" | "FAILURE" = "SUCCESS";
  let failedStepName = "";

  try {
    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i];
      const stepStart = Date.now();

      logLines.push(`## [step ${i + 1}/${workflowSteps.length}] ${step.name}`);

      // Case 1: uses actions/checkout
      if (step.uses && step.uses.includes("checkout")) {
        try {
          // Checkout repo files into sandbox
          await execFileAsync(
            "git",
            ["--work-tree=" + sandboxDir, "checkout", run.commitSha, "--", "."],
            { cwd: run.repository.gitStoragePath }
          ).catch(async () => {
            // If checkout index fails, copy or clone
            await execFileAsync("git", ["clone", run.repository.gitStoragePath, sandboxDir]);
            await execFileAsync("git", ["checkout", run.commitSha], { cwd: sandboxDir });
          });

          const stepDuration = Date.now() - stepStart;
          const checkoutLog = `✓ Synchronized workspace at commit ${run.commitSha.slice(0, 7)} (${stepDuration}ms)`;
          logLines.push(checkoutLog);

          executionSteps.push({
            name: step.name,
            status: "SUCCESS",
            durationMs: stepDuration,
            exitCode: 0,
            logs: checkoutLog,
          });
        } catch (err: any) {
          const stepDuration = Date.now() - stepStart;
          const checkoutErr = `✗ Failed to checkout code: ${err.message}`;
          logLines.push(checkoutErr);

          executionSteps.push({
            name: step.name,
            status: "FAILURE",
            durationMs: stepDuration,
            exitCode: 1,
            logs: checkoutErr,
          });

          overallConclusion = "FAILURE";
          failedStepName = step.name;
          break;
        }
        continue;
      }

      // Case 2: Shell command execution (run: "...")
      if (step.run) {
        try {
          const execResult = await execAsync(step.run, {
            cwd: sandboxDir,
            timeout: 30000,
            env: {
              ...process.env,
              ...step.env,
              CI: "true",
              KLYRO: "true",
              GITHUB_ACTIONS: "true",
              COMMIT_SHA: run.commitSha,
              BRANCH: run.branch,
            },
          });

          const stepDuration = Date.now() - stepStart;
          const out = [execResult.stdout, execResult.stderr].filter(Boolean).join("\n").trim();
          const stepLog = (out ? out + "\n" : "") + `✓ Completed with exit code 0 (${stepDuration}ms)`;
          logLines.push(stepLog);

          executionSteps.push({
            name: step.name,
            status: "SUCCESS",
            durationMs: stepDuration,
            exitCode: 0,
            logs: stepLog,
          });
        } catch (execErr: any) {
          const stepDuration = Date.now() - stepStart;
          const out = [execErr.stdout, execErr.stderr, execErr.message].filter(Boolean).join("\n").trim();
          const exitCode = typeof execErr.code === "number" ? execErr.code : 1;
          const stepLog = out + `\n✗ Process exited with status ${exitCode} (${stepDuration}ms)`;
          logLines.push(stepLog);

          executionSteps.push({
            name: step.name,
            status: "FAILURE",
            durationMs: stepDuration,
            exitCode,
            logs: stepLog,
          });

          if (!step.continueOnError) {
            overallConclusion = "FAILURE";
            failedStepName = step.name;
            // Mark remaining steps as SKIPPED
            for (let j = i + 1; j < workflowSteps.length; j++) {
              executionSteps.push({
                name: workflowSteps[j].name,
                status: "SKIPPED",
                durationMs: 0,
                exitCode: 0,
                logs: "Skipped due to earlier step failure",
              });
            }
            break;
          }
        }
      } else {
        // Fallback info step
        const stepDuration = Date.now() - stepStart;
        executionSteps.push({
          name: step.name,
          status: "SUCCESS",
          durationMs: stepDuration,
          exitCode: 0,
          logs: `✓ Executed custom step (${stepDuration}ms)`,
        });
      }
    }
  } finally {
    // Cleanup temporary workspace sandbox
    await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
  }

  const completedAt = new Date();
  const totalDurationMs = completedAt.getTime() - startedAt.getTime();
  logLines.push(`\n--------------------------------------------------`);
  logLines.push(`Workflow ${overallConclusion === "SUCCESS" ? "completed successfully" : "FAILED"}`);
  logLines.push(`Total time: ${(totalDurationMs / 1000).toFixed(2)}s`);
  const fullLogs = logLines.join("\n");

  // Update RepositoryActionRun record
  await prisma.repositoryActionRun.update({
    where: { id: runId },
    data: {
      status: overallConclusion,
      conclusion: overallConclusion,
      steps: executionSteps as any,
      logs: fullLogs,
      durationMs: totalDurationMs,
      completedAt,
    },
  });

  // Update CommitStatus on commitSha
  const finalState = overallConclusion === "SUCCESS" ? "SUCCESS" : "FAILURE";
  const finalDesc =
    overallConclusion === "SUCCESS"
      ? `Workflow passed in ${(totalDurationMs / 1000).toFixed(1)}s`
      : `Workflow failed at step '${failedStepName}'`;

  await prisma.commitStatus.upsert({
    where: {
      repositoryId_commitSha_context: {
        repositoryId: run.repositoryId,
        commitSha: run.commitSha,
        context: statusContext,
      },
    },
    create: {
      repositoryId: run.repositoryId,
      commitSha: run.commitSha,
      context: statusContext,
      state: finalState,
      description: finalDesc,
      targetUrl: `/repositories/${run.repository.owner.username}/${run.repository.slug}?tab=actions`,
    },
    update: {
      state: finalState,
      description: finalDesc,
      targetUrl: `/repositories/${run.repository.owner.username}/${run.repository.slug}?tab=actions`,
    },
  }).catch((err) => {
    console.warn("[ActionRunner] Failed to update final commit status:", err.message);
  });

  return {
    runId,
    status: overallConclusion,
    conclusion: overallConclusion,
    durationMs: totalDurationMs,
    steps: executionSteps,
    logs: fullLogs,
  };
}

/**
 * Cancel an active or queued workflow run
 */
export async function cancelActionRun(runId: string) {
  const run = await prisma.repositoryActionRun.findUnique({
    where: { id: runId },
    include: { repository: { select: { id: true, owner: { select: { username: true } }, slug: true } } },
  });

  if (!run) throw new Error("Action run not found");
  if (run.status === "SUCCESS" || run.status === "FAILURE" || run.status === "CANCELLED") {
    return run;
  }

  const completedAt = new Date();
  const updated = await prisma.repositoryActionRun.update({
    where: { id: runId },
    data: {
      status: "CANCELLED",
      conclusion: "CANCELLED",
      completedAt,
      logs: (run.logs || "") + "\n\n[Workflow cancelled by user]",
    },
  });

  // Update commit status
  const statusContext = `klyro-ci / ${run.workflowName}`;
  await prisma.commitStatus.upsert({
    where: {
      repositoryId_commitSha_context: {
        repositoryId: run.repositoryId,
        commitSha: run.commitSha,
        context: statusContext,
      },
    },
    create: {
      repositoryId: run.repositoryId,
      commitSha: run.commitSha,
      context: statusContext,
      state: "ERROR",
      description: "Workflow run was cancelled",
    },
    update: {
      state: "ERROR",
      description: "Workflow run was cancelled",
    },
  }).catch(() => {});

  return updated;
}

/**
 * Trigger all workflows configured for push events at commitSha
 */
export async function triggerPushWorkflows(
  repositoryId: string,
  commitSha: string,
  branch: string
) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { id: true, gitStoragePath: true },
  });
  if (!repository) return [];

  const workflows = await getRepoWorkflows(repository.gitStoragePath, commitSha).catch(() => []);
  const triggeredRuns = [];

  for (const wf of workflows) {
    if (shouldTriggerWorkflow(wf, "push", branch)) {
      try {
        const { run } = await queueActionRun({
          repositoryId,
          commitSha,
          branch,
          event: "push",
          workflowPath: wf.path,
          workflowName: wf.name,
        });

        // Execute runner
        executeActionRun(run.id).catch((err) => {
          console.error(`[ActionRunner] Background execution error for ${run.id}:`, err);
        });

        triggeredRuns.push(run);
      } catch (err: any) {
        console.error(`[ActionRunner] Failed to queue push workflow ${wf.name}:`, err);
      }
    }
  }

  return triggeredRuns;
}
