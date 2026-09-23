import { createHash } from "crypto";

export interface RecordPayload {
  userId: string;
  projectId: string;
  milestoneId: string | null;
  roleTitle: string;
  tasksCompleted: number;
  commitsAuthored: number;
  peerAttestations: Array<{
    fromUserId: string;
    fromName: string;
    statement: string;
    rating: number;
  }>;
  issuedAt: string;
}

// Canonical JSON serializer to ensure deterministic hashing
function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

// Computes SHA-256 hash of the canonical record payload
export function generateRecordHash(payload: RecordPayload): string {
  const canonical = canonicalJson(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

export function verifyRecordHash(payload: RecordPayload, expectedHash: string): boolean {
  return generateRecordHash(payload) === expectedHash;
}
