// 04-records & 26-testing: cryptographic contribution record hasher & tamper-resistance.
// Run: node --test tests/records.test.mjs (stdlib only).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

function canonicalJson(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map((item) => canonicalJson(item)).join(",")}]`;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${entries.join(",")}}`;
}

function generateRecordHash(payload) {
  const canonical = canonicalJson(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

function verifyRecordHash(payload, expectedHash) {
  return generateRecordHash(payload) === expectedHash;
}

describe("Cryptographic Contribution Record Integrity", () => {
  const basePayload = {
    userId: "usr_12345",
    projectId: "prj_67890",
    milestoneId: "ms_alpha",
    roleTitle: "Lead Frontend Engineer",
    tasksCompleted: 14,
    commitsAuthored: 42,
    peerAttestations: [
      {
        fromUserId: "usr_99999",
        fromName: "Founder",
        statement: "Outstanding delivery on core components and state management.",
        rating: 5,
      },
    ],
    issuedAt: "2026-09-22T21:00:00.000Z",
  };

  it("generates deterministic 64-char hex SHA-256 hash", () => {
    const hash1 = generateRecordHash(basePayload);
    const hash2 = generateRecordHash(basePayload);
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
    assert.equal(verifyRecordHash(basePayload, hash1), true);
  });

  it("detects tampering when tasksCompleted is modified", () => {
    const originalHash = generateRecordHash(basePayload);
    const tamperedPayload = { ...basePayload, tasksCompleted: 15 };
    assert.equal(verifyRecordHash(tamperedPayload, originalHash), false);
  });

  it("detects tampering when an attestation statement is modified", () => {
    const originalHash = generateRecordHash(basePayload);
    const tamperedPayload = {
      ...basePayload,
      peerAttestations: [
        {
          fromUserId: "usr_99999",
          fromName: "Founder",
          statement: "Altered statement without founder signature.",
          rating: 5,
        },
      ],
    };
    assert.equal(verifyRecordHash(tamperedPayload, originalHash), false);
  });

  it("produces identical hash regardless of object key order", () => {
    const reorderedPayload = {
      roleTitle: basePayload.roleTitle,
      issuedAt: basePayload.issuedAt,
      commitsAuthored: basePayload.commitsAuthored,
      userId: basePayload.userId,
      peerAttestations: basePayload.peerAttestations,
      projectId: basePayload.projectId,
      tasksCompleted: basePayload.tasksCompleted,
      milestoneId: basePayload.milestoneId,
    };
    const hash1 = generateRecordHash(basePayload);
    const hash2 = generateRecordHash(reorderedPayload);
    assert.equal(hash1, hash2);
  });
});
