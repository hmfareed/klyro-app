import YAML from "yaml";
import { getTree, getRawFileBuffer } from "../git-service";

export interface WorkflowStep {
  name: string;
  uses?: string;
  run?: string;
  shell?: string;
  env?: Record<string, string>;
  continueOnError?: boolean;
}

export interface WorkflowJob {
  id: string;
  name: string;
  runsOn?: string;
  steps: WorkflowStep[];
}

export interface WorkflowTriggers {
  push?: {
    branches?: string[];
  } | boolean;
  pull_request?: {
    branches?: string[];
  } | boolean;
  workflow_dispatch?: Record<string, any> | boolean;
}

export interface WorkflowDefinition {
  path: string;
  name: string;
  on: WorkflowTriggers;
  jobs: Record<string, WorkflowJob>;
}

/**
 * Parse a raw YAML workflow string into a validated WorkflowDefinition
 */
export function parseWorkflowYaml(content: string, filePath: string): WorkflowDefinition {
  let doc: any;
  try {
    doc = YAML.parse(content);
  } catch (err: any) {
    throw new Error(`YAML syntax error in ${filePath}: ${err.message}`);
  }

  if (!doc || typeof doc !== "object") {
    throw new Error(`Invalid workflow format in ${filePath}: expected root object`);
  }

  // Derive workflow name or fallback to file basename
  const fallbackName = filePath.split("/").pop()?.replace(/\.(ya?ml)$/i, "") || "Workflow";
  const name = typeof doc.name === "string" && doc.name.trim() ? doc.name.trim() : fallbackName;

  // Normalize triggers (on:)
  const triggers: WorkflowTriggers = {};
  const rawOn = doc.on;

  if (typeof rawOn === "string") {
    triggers[rawOn as keyof WorkflowTriggers] = true;
  } else if (Array.isArray(rawOn)) {
    for (const evt of rawOn) {
      if (typeof evt === "string") {
        triggers[evt as keyof WorkflowTriggers] = true;
      }
    }
  } else if (rawOn && typeof rawOn === "object") {
    if (rawOn.push !== undefined) {
      triggers.push =
        typeof rawOn.push === "object" && rawOn.push !== null
          ? { branches: Array.isArray(rawOn.push.branches) ? rawOn.push.branches.map(String) : undefined }
          : true;
    }
    if (rawOn.pull_request !== undefined) {
      triggers.pull_request =
        typeof rawOn.pull_request === "object" && rawOn.pull_request !== null
          ? { branches: Array.isArray(rawOn.pull_request.branches) ? rawOn.pull_request.branches.map(String) : undefined }
          : true;
    }
    if (rawOn.workflow_dispatch !== undefined) {
      triggers.workflow_dispatch = rawOn.workflow_dispatch || true;
    }
  } else {
    // Default to manual dispatch and push if not explicitly stated
    triggers.push = true;
    triggers.workflow_dispatch = true;
  }

  // Normalize jobs
  const jobs: Record<string, WorkflowJob> = {};
  const rawJobs = doc.jobs;

  if (rawJobs && typeof rawJobs === "object") {
    for (const [jobId, rawJob] of Object.entries(rawJobs)) {
      if (!rawJob || typeof rawJob !== "object") continue;

      const jobObj = rawJob as any;
      const jobName = typeof jobObj.name === "string" ? jobObj.name : jobId;
      const runsOn = typeof jobObj["runs-on"] === "string" ? jobObj["runs-on"] : typeof jobObj.runsOn === "string" ? jobObj.runsOn : "ubuntu-latest";

      const rawSteps = Array.isArray(jobObj.steps) ? jobObj.steps : [];
      const steps: WorkflowStep[] = [];

      for (let i = 0; i < rawSteps.length; i++) {
        const step = rawSteps[i];
        if (!step || typeof step !== "object") continue;

        const stepName = typeof step.name === "string" ? step.name : (step.run ? step.run.split("\n")[0].slice(0, 40) : `Step ${i + 1}`);
        const uses = typeof step.uses === "string" ? step.uses : undefined;
        const run = typeof step.run === "string" ? step.run : undefined;
        const shell = typeof step.shell === "string" ? step.shell : undefined;
        const continueOnError = Boolean(step["continue-on-error"] ?? step.continueOnError);
        const env = step.env && typeof step.env === "object" ? Object.fromEntries(
          Object.entries(step.env).map(([k, v]) => [k, String(v)])
        ) : undefined;

        steps.push({
          name: stepName,
          uses,
          run,
          shell,
          env,
          continueOnError,
        });
      }

      jobs[jobId] = {
        id: jobId,
        name: jobName,
        runsOn,
        steps,
      };
    }
  }

  return {
    path: filePath,
    name,
    on: triggers,
    jobs,
  };
}

/**
 * Discover all workflow files in repository git tree at the given ref
 */
export async function getRepoWorkflows(storagePath: string, ref = "main"): Promise<WorkflowDefinition[]> {
  const workflowDirs = [".klyro/workflows", ".github/workflows"];
  const workflows: WorkflowDefinition[] = [];
  const visitedPaths = new Set<string>();

  for (const dir of workflowDirs) {
    try {
      const tree = await getTree(storagePath, ref, dir);
      if (!tree || !tree.entries) continue;

      for (const entry of tree.entries) {
        if (entry.type === "blob" && /\.(ya?ml)$/i.test(entry.name)) {
          if (visitedPaths.has(entry.name)) continue;
          visitedPaths.add(entry.name);

          try {
            const buffer = await getRawFileBuffer(storagePath, ref, entry.path);
            const def = parseWorkflowYaml(buffer.toString("utf8"), entry.path);
            workflows.push(def);
          } catch (fileErr) {
            console.warn(`[Workflows] Failed to parse workflow ${entry.path}:`, fileErr);
          }
        }
      }
    } catch {
      // Directory may not exist in repo at ref
    }
  }

  return workflows;
}

/**
 * Check if a workflow is triggered by an event and branch
 */
export function shouldTriggerWorkflow(
  workflow: WorkflowDefinition,
  event: "push" | "pull_request" | "workflow_dispatch",
  branch = "main"
): boolean {
  if (event === "workflow_dispatch") {
    return Boolean(workflow.on.workflow_dispatch);
  }

  const triggerConfig = workflow.on[event];
  if (!triggerConfig) return false;
  if (triggerConfig === true) return true;

  if (triggerConfig.branches && triggerConfig.branches.length > 0) {
    const cleanBranch = branch.replace(/^refs\/heads\//, "");
    return triggerConfig.branches.some((b) => b === cleanBranch || b === "*" || (b.endsWith("*") && cleanBranch.startsWith(b.slice(0, -1))));
  }

  return true;
}
