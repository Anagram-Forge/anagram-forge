import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCaption, featuredKeys, featuredScope, isFeaturedId, isPng, pngSize } from "../src/lib/featured-png.ts";

function fakePng(w, h) {
  const b = new Uint8Array(40);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}

test("PNG magic bytes are checked", () => {
  assert.equal(isPng(fakePng(10, 10)), true);
  assert.deepEqual(pngSize(fakePng(1600, 832)), { w: 1600, h: 832 });
  const gif = new TextEncoder().encode("GIF89a".padEnd(40, "x"));
  assert.equal(isPng(gif), false);
  assert.equal(isPng(fakePng(1, 1).slice(0, 20)), false);
  assert.equal(pngSize(fakePng(0, 10)), null);
});

test("only main uses the live keys", () => {
  assert.equal(featuredScope("main"), "");
  assert.equal(featuredScope("featured-render"), "preview/featured-render/");
  assert.equal(featuredScope(""), "preview/local/");
  assert.equal(featuredScope(undefined), "preview/local/");
  assert.equal(featuredScope("Feature/X Y"), "preview/feature-x-y/");
  const live = featuredKeys("");
  const pv = featuredKeys(featuredScope("featured-render"));
  assert.equal(live.now, "featured:now");
  assert.notEqual(pv.now, live.now);
  assert.ok(pv.object("1").startsWith("preview/"));
});

test("captions and ids are cleaned", () => {
  assert.equal(cleanCaption("  <b>Hi</b>\nthere "), "b Hi /b there");
  assert.equal(cleanCaption(""), "A render from the forge.");
  assert.equal(cleanCaption("x".repeat(200)).length, 80);
  assert.equal(isFeaturedId("1763712000000-abc12345"), true);
  assert.equal(isFeaturedId("../secret"), false);
});
