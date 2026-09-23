// 05-projects & 26-testing: application status transitions and permission validation.
// Run: node --test tests/applications.test.mjs (stdlib only).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const VALID_TRANSITIONS = {
  PENDING: new Set(["ACCEPTED", "REJECTED", "WITHDRAWN"]),
  ACCEPTED: new Set([]), // terminal state
  REJECTED: new Set([]), // terminal state
  WITHDRAWN: new Set([]), // terminal state
};

function canTransition(current, next) {
  return VALID_TRANSITIONS[current]?.has(next) ?? false;
}

const PERMISSION_RANK = {
  OWNER: 4,
  MAINTAINER: 3,
  CONTRIBUTOR: 2,
  VIEWER: 1,
};

function canReviewApplications(role) {
  return (PERMISSION_RANK[role] ?? 0) >= PERMISSION_RANK.MAINTAINER;
}

describe("Application State Machine", () => {
  it("allows PENDING -> ACCEPTED and PENDING -> REJECTED", () => {
    assert.equal(canTransition("PENDING", "ACCEPTED"), true);
    assert.equal(canTransition("PENDING", "REJECTED"), true);
  });

  it("blocks mutating already decided applications", () => {
    assert.equal(canTransition("ACCEPTED", "REJECTED"), false);
    assert.equal(canTransition("REJECTED", "ACCEPTED"), false);
  });
});

describe("Application Review Permissions", () => {
  it("grants review capabilities only to OWNER and MAINTAINER", () => {
    assert.equal(canReviewApplications("OWNER"), true);
    assert.equal(canReviewApplications("MAINTAINER"), true);
    assert.equal(canReviewApplications("CONTRIBUTOR"), false);
    assert.equal(canReviewApplications("VIEWER"), false);
  });
});
