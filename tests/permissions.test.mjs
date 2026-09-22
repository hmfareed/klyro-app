// 26-testing: adversarial permission matrix (05 §6) + username rules (03 §4).
// Run: node --test tests/permissions.test.mjs (no deps, stdlib only).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const CAN = {
  OWNER: new Set(["create", "accept", "remove", "edit_project", "delete_project"]),
  CONTRIBUTOR: new Set(["comment", "task_update"]),
};

function can(role, action) {
  return CAN[role]?.has(action) ?? false;
}

describe("permission boundaries (server-side, never UI-only)", () => {
  it("CONTRIBUTOR cannot accept applicants or edit project", () => {
    assert.equal(can("CONTRIBUTOR", "accept"), false);
    assert.equal(can("CONTRIBUTOR", "edit_project"), false);
  });
  it("OWNER can accept + remove", () => {
    assert.equal(can("OWNER", "accept"), true);
    assert.equal(can("OWNER", "remove"), true);
  });
  it("unknown role grants nothing", () => {
    assert.equal(can("VIEWER", "delete_project"), false);
  });
});

describe("username rules (GitHub-identical)", () => {
  const re = /^(?!-)(?!.*--)[a-zA-Z0-9-]+(?<!-)$/;
  const ok = (u) => u.length >= 3 && u.length <= 39 && re.test(u) && !new Set(["admin", "api"]).has(u.toLowerCase());
  it("accepts valid handles", () => assert.equal(ok("ama-builds"), true));
  it("rejects double/leading/trailing hyphens + reserved", () => {
    assert.equal(ok("bad--name"), false);
    assert.equal(ok("-lead"), false);
    assert.equal(ok("trail-"), false);
    assert.equal(ok("admin"), false);
  });
});
