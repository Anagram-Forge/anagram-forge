import assert from "node:assert/strict";
import { test } from "node:test";
import { FAIL_LIMIT, isLocked, recordFail } from "./login-guard.ts";
import { passwordIssue } from "./password.ts";
import { cleanRack, rackStored } from "./rack-clean.ts";

test("password rules", () => {
  assert.equal(passwordIssue("short"), "Password needs 10 characters.");
  assert.equal(passwordIssue("aaaaaaaaaa"), "Use more than one character.");
  assert.equal(passwordIssue("a".repeat(129)), "Password is too long.");
  assert.equal(passwordIssue("correct horse"), null);
});

test("lock after five misses", () => {
  const start = 1_000_000;
  let state = recordFail(null, start);
  for (let i = 0; i < FAIL_LIMIT - 1; i++) state = recordFail(state, start + i);
  assert.equal(isLocked(state, start), true);
  assert.equal(state.n, FAIL_LIMIT);
  assert.ok(state.lockUntil > start);
  assert.equal(isLocked(state, state.lockUntil + 1), false);
  const again = recordFail(state, state.lockUntil + 1);
  assert.equal(again.n, 1);
  assert.equal(again.lockUntil, 0);
});

test("saved racks keep letters and blanks only", () => {
  assert.deepEqual(cleanRack("Ab<script>?"), { letters: "abscript", blanks: 1 });
  assert.equal(rackStored("Ab<script>?"), "ABSCRIPT?");
  assert.equal(cleanRack("a"), null);
});
