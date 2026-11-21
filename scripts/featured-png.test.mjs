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

import { cleanCipherSettings, easternStamp } from "../src/lib/featured-png.ts";

const GOOD = {
  v: 1, text: "נפלים", finals: false, mode: "fold", material: "diamond", lighting: "golden", font: "serif",
  fold: 0.8, gap: 0.14, sharp: 0.8, layers: 17, colorByLetter: false, evolve: true, spin: true,
  spinSpeed: 1, evolveSpeed: 1, locked: false, lockYaw: 0, lockPitch: 0, yaw: 2.4, pitch: 0.35, t: 12.5,
};

test("settings: good ones pass, numbers clamp", () => {
  assert.deepEqual(cleanCipherSettings(GOOD), GOOD);
  const c = cleanCipherSettings({ ...GOOD, fold: 99, layers: 17.6, lockYaw: -999, pitch: 5 });
  assert.equal(c.fold, 2);
  assert.equal(c.layers, 18);
  assert.equal(c.lockYaw, -180);
  assert.equal(c.pitch, 1.6);
  assert.equal(cleanCipherSettings({ ...GOOD, text: "  Yeshua   is King " }).text, "Yeshua is King");
});

test("settings: strict allowlist, enums, types, letter cap", () => {
  assert.equal(cleanCipherSettings({ ...GOOD, extra: 1 }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, href: "/x" }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, mode: "cube" }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, material: "<b>" }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, fold: "1" }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, fold: NaN }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, spin: "yes" }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, v: 2 }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, text: "a".repeat(25) }), null);
  assert.ok(cleanCipherSettings({ ...GOOD, text: "a".repeat(24) }));
  assert.equal(cleanCipherSettings({ ...GOOD, text: "abc1" }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, text: "<script>" }), null);
  assert.equal(cleanCipherSettings({ ...GOOD, text: "   " }), null);
  const { yaw: _y, ...missing } = GOOD;
  assert.equal(cleanCipherSettings(missing), null);
  assert.equal(cleanCipherSettings(null), null);
  assert.equal(cleanCipherSettings([GOOD]), null);
});

test("owner stamp is 24-hour Eastern, DD-Mon-YYYY", () => {
  assert.equal(easternStamp(Date.UTC(2026, 10, 21, 7, 50)), "21-Nov-2026 02:50 ET");
  assert.equal(easternStamp(Date.UTC(2026, 6, 4, 23, 5)), "04-Jul-2026 19:05 ET");
});
