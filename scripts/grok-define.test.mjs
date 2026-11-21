import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GROK_PER_DAY,
  GROK_PER_IP_HOUR,
  cleanDefineWord,
  grokDefine,
  parseGrokDefinition,
} from "../src/lib/grok-define-core.ts";

function fakeKv() {
  const m = new Map();
  return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v) };
}

const REPLY = "pos: noun\ndef: A small sea creature with a hard shell.";

test("input validation: letters only, 1–30, lowercased", () => {
  assert.equal(cleanDefineWord("Zymurgy"), "zymurgy");
  assert.equal(cleanDefineWord("  qat "), "qat");
  assert.equal(cleanDefineWord("a".repeat(30)), "a".repeat(30));
  assert.equal(cleanDefineWord("a".repeat(31)), null);
  for (const bad of ["", "two words", "it's", "abc1", "<b>", "naïve", null, 42, ["x"]]) {
    assert.equal(cleanDefineWord(bad), null, String(bad));
  }
});

test("bad words never reach Grok", async () => {
  let calls = 0;
  const r = await grokDefine("drop table", { kv: fakeKv(), ask: async () => (calls++, REPLY), scope: "", visitor: "v" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(calls, 0);
});

test("second ask for a word is a cache hit with no call", async () => {
  const kv = fakeKv();
  let calls = 0;
  const sent = [];
  const deps = { kv, ask: async (w) => (calls++, sent.push(w), REPLY), scope: "preview/x/", visitor: "v" };
  const a = await grokDefine("Barnacle", deps);
  const b = await grokDefine("barnacle", { ...deps, visitor: "someone-else" });
  assert.equal(a.ok && a.cached, false);
  assert.equal(b.ok && b.cached, true);
  assert.equal(calls, 1);
  assert.deepEqual(sent, ["barnacle"]);
  assert.ok(kv.m.has("preview/x/gdef:w:barnacle"));
  assert.ok(![...kv.m.keys()].some((k) => k.startsWith("gdef:")), "preview never writes live keys");
});

test("not-a-word answers are kept plainly", () => {
  const d = parseGrokDefinition("xqzt", "pos: none\ndef: Not a recognized English word.");
  assert.equal(d.real, false);
  assert.equal(d.pos, "");
  assert.equal(parseGrokDefinition("x", "I think it means..."), null);
});

test("per-visitor and daily limits", async () => {
  const kv = fakeKv();
  const now = Date.UTC(2026, 10, 21, 7, 0);
  let calls = 0;
  const deps = { kv, ask: async () => (calls++, REPLY), scope: "", visitor: "v", now };
  for (let i = 0; i < GROK_PER_IP_HOUR; i++) assert.equal((await grokDefine(`w${"a".repeat(i + 1)}`, deps)).ok, true);
  const over = await grokDefine("another", deps);
  assert.equal(over.ok, false);
  assert.equal(over.status, 429);
  assert.equal(calls, GROK_PER_IP_HOUR);
  kv.m.set("gdef:day:2026-11-21", String(GROK_PER_DAY));
  const day = await grokDefine("fresh", { ...deps, visitor: "new" });
  assert.equal(day.ok, false);
  assert.equal(day.status, 429);
});

test("model errors are not cached", async () => {
  const kv = fakeKv();
  const r = await grokDefine("word", { kv, ask: async () => { throw new Error("down"); }, scope: "", visitor: "v" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 502);
  assert.equal(kv.m.has("gdef:w:word"), false);
});
