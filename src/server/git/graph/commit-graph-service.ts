import { runGit } from "../git-service";

export interface GraphCommitNode {
  sha: string;
  shortSha: string;
  parents: string[];
  author: {
    name: string;
    email: string;
    date: string;
    relativeDate: string;
  };
  message: string;
  refs: {
    branches: string[];
    tags: string[];
    isHead: boolean;
  };
  lane: number;
  x: number;
  y: number;
  color: string;
}

export interface GraphEdgeLink {
  id: string;
  fromSha: string;
  toSha: string;
  fromLane: number;
  toLane: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  pathD: string;
  color: string;
  isMerge: boolean;
}

export interface CommitGraphResult {
  nodes: GraphCommitNode[];
  links: GraphEdgeLink[];
  branches: string[];
  tags: string[];
  totalLanes: number;
  dimensions: {
    width: number;
    height: number;
    laneWidth: number;
    rowHeight: number;
  };
}

// 8 vibrant high-contrast AMOLED colors for lanes
export const LANE_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#3b82f6", // Blue
];

export const LANE_WIDTH = 24;
export const ROW_HEIGHT = 52;
export const NODE_OFFSET_X = 18;
export const NODE_OFFSET_Y = 26;

/**
 * Parses Git %D ref decorative string into branches, tags, and HEAD flag
 */
export function parseRefDecorations(decorations: string): {
  branches: string[];
  tags: string[];
  isHead: boolean;
} {
  const branches: string[] = [];
  const tags: string[] = [];
  let isHead = false;

  if (!decorations || !decorations.trim()) {
    return { branches, tags, isHead };
  }

  const parts = decorations
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.startsWith("HEAD -> ")) {
      isHead = true;
      const branch = part.replace("HEAD -> ", "").trim();
      if (branch && !branches.includes(branch)) {
        branches.push(branch);
      }
    } else if (part === "HEAD") {
      isHead = true;
    } else if (part.startsWith("tag: ")) {
      const tag = part.replace("tag: ", "").trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    } else {
      // General ref e.g. refs/heads/feature or feature or origin/feature
      const clean = part.replace(/^refs\/heads\//, "");
      if (clean && !branches.includes(clean)) {
        branches.push(clean);
      }
    }
  }

  return { branches, tags, isHead };
}

/**
 * Builds the visual topological DAG commit graph
 */
export async function buildCommitGraph(
  storagePath: string,
  options: {
    ref?: string;
    limit?: number;
    skip?: number;
  } = {}
): Promise<CommitGraphResult> {
  const limit = Math.min(Math.max(options.limit || 100, 1), 500);
  const skip = Math.max(options.skip || 0, 0);

  const gitArgs = [
    "log",
    "--date-order",
    "--topo-order",
    `--format=%H|%h|%P|%an|%ae|%aI|%cr|%s|%D`,
    "-n",
    limit.toString(),
    "--skip",
    skip.toString(),
  ];

  if (!options.ref || options.ref === "all") {
    gitArgs.push("--all");
  } else {
    gitArgs.push(options.ref);
  }

  let stdout = "";
  try {
    const res = await runGit(storagePath, gitArgs);
    stdout = res.stdout;
  } catch {
    return {
      nodes: [],
      links: [],
      branches: [],
      tags: [],
      totalLanes: 0,
      dimensions: {
        width: 100,
        height: 100,
        laneWidth: LANE_WIDTH,
        rowHeight: ROW_HEIGHT,
      },
    };
  }

  const lines = stdout.trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    return {
      nodes: [],
      links: [],
      branches: [],
      tags: [],
      totalLanes: 0,
      dimensions: {
        width: 100,
        height: 100,
        laneWidth: LANE_WIDTH,
        rowHeight: ROW_HEIGHT,
      },
    };
  }

  const rawCommits: Array<{
    sha: string;
    shortSha: string;
    parents: string[];
    author: { name: string; email: string; date: string; relativeDate: string };
    message: string;
    refs: { branches: string[]; tags: string[]; isHead: boolean };
  }> = [];

  const allBranchesSet = new Set<string>();
  const allTagsSet = new Set<string>();

  for (const line of lines) {
    const [sha, shortSha, parentsStr, authorName, authorEmail, date, relativeDate, message, decorations] =
      line.split("|");

    if (!sha) continue;

    const parents = parentsStr ? parentsStr.trim().split(" ").filter(Boolean) : [];
    const parsedRefs = parseRefDecorations(decorations || "");

    parsedRefs.branches.forEach((b) => allBranchesSet.add(b));
    parsedRefs.tags.forEach((t) => allTagsSet.add(t));

    rawCommits.push({
      sha,
      shortSha,
      parents,
      author: {
        name: authorName || "Unknown",
        email: authorEmail || "",
        date: date || new Date().toISOString(),
        relativeDate: relativeDate || "",
      },
      message: message || "No message",
      refs: parsedRefs,
    });
  }

  // --- Topological Lane Allocation Algorithm ---
  const activeLanes: (string | null)[] = [];
  const nodes: GraphCommitNode[] = [];
  const commitIndexMap = new Map<string, number>();

  let maxLanesUsed = 0;

  for (let index = 0; index < rawCommits.length; index++) {
    const c = rawCommits[index];
    commitIndexMap.set(c.sha, index);

    // 1. Identify which lane this commit belongs to
    let lane = activeLanes.indexOf(c.sha);

    if (lane === -1) {
      // Find empty slot or allocate a new column
      lane = activeLanes.indexOf(null);
      if (lane === -1) {
        lane = activeLanes.length;
        activeLanes.push(null);
      }
    }

    if (lane + 1 > maxLanesUsed) {
      maxLanesUsed = lane + 1;
    }

    const color = LANE_COLORS[lane % LANE_COLORS.length];
    const x = lane * LANE_WIDTH + NODE_OFFSET_X;
    const y = index * ROW_HEIGHT + NODE_OFFSET_Y;

    nodes.push({
      ...c,
      lane,
      x,
      y,
      color,
    });

    // 2. Update active lanes for parents
    if (c.parents.length === 0) {
      // Root commit terminates lane
      activeLanes[lane] = null;
    } else if (c.parents.length === 1) {
      const parentSha = c.parents[0];
      const existingParentLane = activeLanes.indexOf(parentSha);
      if (existingParentLane !== -1 && existingParentLane !== lane) {
        // Parent already tracked in another lane, this lane merges into it
        activeLanes[lane] = null;
      } else {
        activeLanes[lane] = parentSha;
      }
    } else {
      // Merge commit (2+ parents)
      const primaryParent = c.parents[0];
      const existingPrimaryLane = activeLanes.indexOf(primaryParent);
      if (existingPrimaryLane !== -1 && existingPrimaryLane !== lane) {
        activeLanes[lane] = null;
      } else {
        activeLanes[lane] = primaryParent;
      }

      // Track secondary parents in additional lanes
      for (let pIdx = 1; pIdx < c.parents.length; pIdx++) {
        const secondaryParent = c.parents[pIdx];
        if (!activeLanes.includes(secondaryParent)) {
          let emptySlot = activeLanes.indexOf(null);
          if (emptySlot === -1) {
            emptySlot = activeLanes.length;
            activeLanes.push(null);
          }
          activeLanes[emptySlot] = secondaryParent;
          if (emptySlot + 1 > maxLanesUsed) {
            maxLanesUsed = emptySlot + 1;
          }
        }
      }
    }
  }

  // --- Edge / Link Generation ---
  const links: GraphEdgeLink[] = [];
  const nodeMap = new Map<string, GraphCommitNode>();
  nodes.forEach((n) => nodeMap.set(n.sha, n));

  for (const node of nodes) {
    for (let pIdx = 0; pIdx < node.parents.length; pIdx++) {
      const parentSha = node.parents[pIdx];
      const parentNode = nodeMap.get(parentSha);

      const isMerge = node.parents.length > 1 && pIdx > 0;
      const toLane = parentNode ? parentNode.lane : node.lane;
      const toX = toLane * LANE_WIDTH + NODE_OFFSET_X;
      const toY = parentNode
        ? parentNode.y
        : (nodes.length) * ROW_HEIGHT + NODE_OFFSET_Y;

      const fromX = node.x;
      const fromY = node.y;

      let pathD = "";
      if (fromX === toX) {
        // Direct vertical straight rail
        pathD = `M ${fromX} ${fromY} L ${toX} ${toY}`;
      } else {
        // Smooth cubic bezier curve for branching / merging
        const deltaY = toY - fromY;
        const cpY1 = fromY + deltaY * 0.45;
        const cpY2 = fromY + deltaY * 0.55;
        pathD = `M ${fromX} ${fromY} C ${fromX} ${cpY1}, ${toX} ${cpY2}, ${toX} ${toY}`;
      }

      const linkColor = isMerge
        ? LANE_COLORS[toLane % LANE_COLORS.length]
        : node.color;

      links.push({
        id: `${node.sha}-${parentSha}`,
        fromSha: node.sha,
        toSha: parentSha,
        fromLane: node.lane,
        toLane,
        fromX,
        fromY,
        toX,
        toY,
        pathD,
        color: linkColor,
        isMerge,
      });
    }
  }

  const totalLanes = Math.max(maxLanesUsed, 1);
  const graphWidth = totalLanes * LANE_WIDTH + NODE_OFFSET_X * 2;
  const graphHeight = nodes.length * ROW_HEIGHT + NODE_OFFSET_Y * 2;

  return {
    nodes,
    links,
    branches: Array.from(allBranchesSet),
    tags: Array.from(allTagsSet),
    totalLanes,
    dimensions: {
      width: Math.max(graphWidth, 80),
      height: Math.max(graphHeight, 100),
      laneWidth: LANE_WIDTH,
      rowHeight: ROW_HEIGHT,
    },
  };
}
