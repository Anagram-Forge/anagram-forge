import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { soot } from "@/lib/palette";
import { cn } from "@/lib/utils";

/**
 * 3D Hebrew Cipher (behind the door at /the-way). Ported from REM's canvas page.
 * Renderer and math are unchanged; only the UI kit was swapped for the site's own.
 * Plain canvas 2D, no network, no fonts fetched. System serif / the site sans stack.
 */

const SANS = '"Source Sans 3", "Segoe UI", system-ui, sans-serif';

type Info = [string, number, number];
const HEB: Record<string, Info> = {
  א: ["Aleph", 1, 1],
  ב: ["Bet", 2, 2],
  ג: ["Gimel", 3, 3],
  ד: ["Dalet", 4, 4],
  ה: ["He", 5, 5],
  ו: ["Vav", 6, 6],
  ז: ["Zayin", 7, 7],
  ח: ["Het", 8, 8],
  ט: ["Tet", 9, 9],
  י: ["Yod", 10, 10],
  כ: ["Kaf", 20, 20],
  ך: ["Final Kaf", 20, 500],
  ל: ["Lamed", 30, 30],
  מ: ["Mem", 40, 40],
  ם: ["Final Mem", 40, 600],
  נ: ["Nun", 50, 50],
  ן: ["Final Nun", 50, 700],
  ס: ["Samekh", 60, 60],
  ע: ["Ayin", 70, 70],
  פ: ["Pe", 80, 80],
  ף: ["Final Pe", 80, 800],
  צ: ["Tsadi", 90, 90],
  ץ: ["Final Tsadi", 90, 900],
  ק: ["Qof", 100, 100],
  ר: ["Resh", 200, 200],
  ש: ["Shin", 300, 300],
  ת: ["Tav", 400, 400],
};
const GA = Math.PI * (3 - Math.sqrt(5));
const PHI = (1 + Math.sqrt(5)) / 2;

type Letter = { ch: string; name: string; value: number };
type Mode = "fold" | "stacked" | "spiral" | "sphere" | "helix";
type V3 = [number, number, number];
type Placed = { c: V3; u: V3; v: V3; w: V3; s: number; half: number; label: boolean };

type MatKey =
  | "glass"
  | "diamond"
  | "ruby"
  | "sapphire"
  | "emerald"
  | "amethyst"
  | "gold"
  | "obsidian"
  | "glossy"
  | "matte";
type Mat = {
  label: string;
  base: V3 | null;
  alpha: number;
  spec: number;
  edge: number;
  facets: number;
  clear: boolean;
  metal?: boolean;
  prism?: boolean;
};
const MATS: Record<MatKey, Mat> = {
  glass: {
    label: "Clear glass",
    base: [0.82, 0.92, 1],
    alpha: 0.12,
    spec: 1,
    edge: 1,
    facets: 1,
    clear: true,
  },
  diamond: {
    label: "Diamond",
    base: [0.9, 0.95, 1],
    alpha: 0.18,
    spec: 1.4,
    edge: 1,
    facets: 5,
    clear: true,
    prism: true,
  },
  ruby: {
    label: "Ruby",
    base: [0.9, 0.06, 0.2],
    alpha: 0.45,
    spec: 1.1,
    edge: 0.8,
    facets: 4,
    clear: true,
  },
  sapphire: {
    label: "Sapphire",
    base: [0.12, 0.3, 0.95],
    alpha: 0.45,
    spec: 1.1,
    edge: 0.8,
    facets: 4,
    clear: true,
  },
  emerald: {
    label: "Emerald",
    base: [0.05, 0.72, 0.4],
    alpha: 0.45,
    spec: 1,
    edge: 0.8,
    facets: 3,
    clear: true,
  },
  amethyst: {
    label: "Amethyst",
    base: [0.62, 0.3, 0.88],
    alpha: 0.45,
    spec: 1,
    edge: 0.8,
    facets: 3,
    clear: true,
  },
  gold: {
    label: "Polished gold",
    base: [1, 0.76, 0.3],
    alpha: 1,
    spec: 1,
    edge: 0.35,
    facets: 2,
    clear: false,
    metal: true,
  },
  obsidian: {
    label: "Obsidian",
    base: [0.07, 0.07, 0.09],
    alpha: 1,
    spec: 1,
    edge: 0.4,
    facets: 2,
    clear: false,
  },
  glossy: {
    label: "Glossy color",
    base: null,
    alpha: 1,
    spec: 0.7,
    edge: 0.2,
    facets: 1,
    clear: false,
  },
  matte: {
    label: "Matte color",
    base: null,
    alpha: 1,
    spec: 0.1,
    edge: 0.1,
    facets: 0,
    clear: false,
  },
};

type LightKey = "golden" | "studio" | "blue" | "moon" | "noon";
type Light = { label: string; sky: string[] | null; dir: V3; col: V3; amb: V3; bright: boolean };
const LIGHTS: Record<LightKey, Light> = {
  golden: {
    label: "Golden hour",
    sky: ["#2a1d45", "#b8605a", "#f2b35e"],
    dir: [0.9, 0.25, -0.35],
    col: [1, 0.72, 0.42],
    amb: [0.32, 0.22, 0.28],
    bright: false,
  },
  studio: {
    label: "Studio",
    sky: null,
    dir: [-0.5, 0.7, -0.6],
    col: [1, 1, 1],
    amb: [0.35, 0.35, 0.37],
    bright: false,
  },
  blue: {
    label: "Blue hour",
    sky: ["#070f26", "#1d3466", "#4f6fa3"],
    dir: [-0.6, 0.4, -0.5],
    col: [0.62, 0.76, 1],
    amb: [0.14, 0.18, 0.32],
    bright: false,
  },
  moon: {
    label: "Moonlight",
    sky: ["#020308", "#0a0f1c", "#151d30"],
    dir: [0.3, 0.9, -0.3],
    col: [0.78, 0.85, 1],
    amb: [0.05, 0.06, 0.11],
    bright: false,
  },
  noon: {
    label: "Noon sun",
    sky: ["#6aa8f7", "#a9cdfb", "#e3effd"],
    dir: [0.1, 1, -0.25],
    col: [1, 0.98, 0.94],
    amb: [0.45, 0.48, 0.55],
    bright: true,
  },
};

type FontKey = "serif" | "sans" | "thin";
const FONTS: Record<FontKey, string> = {
  serif: "Serif (scroll style)",
  sans: "Bold sans",
  thin: "Thin sans",
};

function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function hsl(h: number, s: number, l: number): V3 {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}
const c255 = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
const rgba = (c: V3, a: number) =>
  `rgba(${c255(c[0])},${c255(c[1])},${c255(c[2])},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

function parse(text: string, finals: boolean): Letter[] {
  const out: Letter[] = [];
  for (const ch of Array.from(text)) {
    const h = HEB[ch];
    if (h) out.push({ ch, name: h[0], value: finals ? h[2] : h[1] });
    else if (/[a-zA-Z]/.test(ch)) {
      const u = ch.toUpperCase();
      out.push({ ch: u, name: "Latin " + u, value: u.charCodeAt(0) - 64 });
    }
  }
  return out.slice(0, 24);
}

function place(L: Letter[], mode: Mode, t: number, fold: number, gap: number): Placed[] {
  const n = Math.max(L.length, 1);
  const total = L.reduce((s, l) => s + l.value, 0);
  const hsum = L.reduce((s, l, i) => s + l.value * (i + 1), 0);
  const seed = ((hsum / PHI) % 1) * Math.PI * 2;
  const twist = (total % 22) / 22;

  if (mode === "fold") {
    let T: V3 = [0, 1, 0],
      N: V3 = [1, 0, 0],
      B: V3 = [0, 0, 1];
    let p: V3 = [0, 0, 0];
    const prog = 0.5 + 0.5 * Math.cos(t * 0.5);
    const bond = gap * 2.2;
    const raw = L.map((l, i) => {
      const vn = Math.log(l.value + 1) / Math.log(901);
      if (i > 0) {
        const th = fold * (0.25 + 0.9 * vn) * prog;
        const ph = (l.value * GA + seed) * prog;
        const cT = Math.cos(th),
          sT = Math.sin(th);
        const T1: V3 = [T[0] * cT + N[0] * sT, T[1] * cT + N[1] * sT, T[2] * cT + N[2] * sT];
        const N1: V3 = [N[0] * cT - T[0] * sT, N[1] * cT - T[1] * sT, N[2] * cT - T[2] * sT];
        const cP = Math.cos(ph),
          sP = Math.sin(ph);
        const N2: V3 = [N1[0] * cP + B[0] * sP, N1[1] * cP + B[1] * sP, N1[2] * cP + B[2] * sP];
        const B2: V3 = [B[0] * cP - N1[0] * sP, B[1] * cP - N1[1] * sP, B[2] * cP - N1[2] * sP];
        T = norm(T1);
        N = norm(N2);
        B = norm(B2);
        p = [p[0] + T[0] * bond, p[1] + T[1] * bond, p[2] + T[2] * bond];
      }
      return { c: p, u: N, v: B, w: T };
    });
    const cx = raw.reduce((s, r) => s + r.c[0], 0) / n,
      cy = raw.reduce((s, r) => s + r.c[1], 0) / n,
      cz = raw.reduce((s, r) => s + r.c[2], 0) / n;
    const maxR = raw.reduce(
      (m, r) => Math.max(m, Math.hypot(r.c[0] - cx, r.c[1] - cy, r.c[2] - cz)),
      0.001,
    );
    const k = maxR > 1.4 ? 1.4 / maxR : 1;
    return raw.map((r) => ({
      c: [(r.c[0] - cx) * k, (r.c[1] - cy) * k, (r.c[2] - cz) * k],
      u: r.u,
      v: r.v,
      w: r.w,
      s: 0.5 * k,
      half: Math.max(0.02, gap * 0.45) * k,
      label: false,
    }));
  }

  let acc = 0;
  return L.map((l, i) => {
    const vn = Math.log(l.value + 1) / Math.log(901);
    if (mode === "stacked") {
      acc += l.value * GA * fold;
      const r = seed * fold + acc + t * 0.3 * fold * ((i + 1) / n);
      return {
        c: [0, (i - (n - 1) / 2) * gap, 0],
        u: [Math.cos(r), 0, Math.sin(r)],
        v: [-Math.sin(r), 0, Math.cos(r)],
        w: [0, 1, 0],
        s: 0.95,
        half: gap * 0.45,
        label: false,
      };
    }
    const drift = t * 0.12 * (1 + (l.value % 9) / 9);
    let x = 0,
      y = 0,
      z = 0,
      a = 0;
    if (mode === "spiral") {
      a = i * GA + seed + drift;
      const r = 0.35 + 1.25 * Math.sqrt((i + 0.5) / n);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      y = (vn - 0.5) * 1.8;
    } else if (mode === "sphere") {
      const yy = 1 - (2 * (i + 0.5)) / n;
      const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      a = i * GA + seed + drift;
      const R = 1.1 + 0.5 * vn;
      x = Math.cos(a) * rr * R;
      z = Math.sin(a) * rr * R;
      y = yy * R;
    } else {
      a = seed + i * ((Math.PI * 2) / PHI / PHI) * (1 + twist) + drift;
      const r = 0.8 + 0.6 * vn;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      y = (n === 1 ? 0 : i / (n - 1) - 0.5) * 2.4;
    }
    y += 0.06 * Math.sin(t * 0.8 + l.value);
    const yaw = -a + Math.PI / 2;
    return {
      c: [x, y, z],
      u: [Math.cos(yaw), 0, Math.sin(yaw)],
      v: [0, 1, 0],
      w: [-Math.sin(yaw), 0, Math.cos(yaw)],
      s: 0.36,
      half: 0.07,
      label: true,
    };
  });
}

function CipherView(props: ViewProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const live = useRef(props);
  live.current = props;
  const view = useRef({ yaw: 0.6, pitch: 0.35, drag: false, lx: 0, ly: 0, t: 0 });
  const trails = useRef<{ key: string; pts: V3[][] }>({ key: "", pts: [] });

  useEffect(() => {
    view.current.yaw = 0.6;
    view.current.pitch = 0.35;
    view.current.t = 0;
  }, [props.resetKey]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = live.current;
      const v = view.current;
      if (p.evolve) v.t += dt * p.evolveSpeed;
      if (p.locked) {
        v.yaw = (p.lockYaw * Math.PI) / 180;
        v.pitch = (p.lockPitch * Math.PI) / 180;
      } else if (p.spin && !v.drag) v.yaw += dt * 0.25 * p.spinSpeed;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const W = cv.clientWidth,
        HH = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(HH * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(HH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";

      const mat = MATS[p.material];
      const lit = LIGHTS[p.lighting];
      const bright = lit.sky ? lit.bright : false;
      if (lit.sky) {
        const grad = ctx.createLinearGradient(0, 0, 0, HH);
        lit.sky.forEach((c, i) => grad.addColorStop(i / (lit.sky!.length - 1), c));
        ctx.fillStyle = grad;
      } else ctx.fillStyle = soot.bg;
      ctx.fillRect(0, 0, W, HH);

      const Ld = norm(lit.dir);
      const Hd = norm([Ld[0], Ld[1], Ld[2] - 1]);
      const pos = place(p.letters, p.mode, v.t, p.fold, p.gap);
      const cy = Math.cos(v.yaw),
        sy = Math.sin(v.yaw),
        cp = Math.cos(v.pitch),
        sp = Math.sin(v.pitch);
      const rot = (x: number, y: number, z: number): V3 => {
        const x1 = x * cy - z * sy,
          z1 = x * sy + z * cy;
        return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
      };
      const f = Math.min(W, HH) * 1.25,
        D = 5;
      const proj = (q: V3): V3 => {
        const k = f / (q[2] + D);
        return [W / 2 + q[0] * k, HH / 2 - q[1] * k, q[2]];
      };
      const P = (x: number, y: number, z: number): V3 => proj(rot(x, y, z));
      const centers = pos.map((q) => P(q.c[0], q.c[1], q.c[2]));
      const ink = bright ? "rgba(0,0,0," : "rgba(255,255,255,";

      const tkey = p.mode + "|" + p.letters.map((l) => l.ch + l.value).join("") + "|" + p.resetKey;
      const tr = trails.current;
      if (tr.key !== tkey || !p.trail) {
        tr.key = tkey;
        tr.pts = pos.map(() => []);
      }
      if (p.trail && p.evolve)
        pos.forEach((q, i) => {
          const a = tr.pts[i];
          if (!a) return;
          a.push([q.c[0], q.c[1], q.c[2]]);
          if (a.length > 1500) a.shift();
        });
      if (p.trail) {
        ctx.lineWidth = 1.2;
        tr.pts.forEach((a, i) => {
          if (a.length < 2) return;
          ctx.strokeStyle = rgba(hsl(((p.letters[i]?.value || 1) * 137.508) % 360, 0.7, 0.6), 0.55);
          ctx.beginPath();
          a.forEach((q, j) => {
            const r = P(q[0], q[1], q[2]);
            if (j) ctx.lineTo(r[0], r[1]);
            else ctx.moveTo(r[0], r[1]);
          });
          ctx.stroke();
        });
      }
      if (p.mode !== "stacked" && centers.length > 1) {
        ctx.strokeStyle = ink + "0.22)";
        ctx.lineWidth = p.mode === "fold" ? 2 : 1;
        ctx.beginPath();
        centers.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
        ctx.stroke();
      }

      const fam = p.font === "serif" ? "serif" : SANS;
      const wt = p.font === "thin" ? 300 : p.font === "sans" ? 800 : 600;
      ctx.font = `${wt} 120px ${fam}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const order = pos.map((_, i) => i).sort((a, b) => centers[b][2] - centers[a][2]);
      const nl = Math.max(1, Math.round(p.layers));

      for (const i of order) {
        const l = p.letters[i];
        const pl = pos[i];
        const lc = hsl((l.value * 137.508) % 360, 0.65, 0.55);
        const base: V3 = mat.base
          ? p.colorByLetter
            ? [(mat.base[0] + lc[0]) / 2, (mat.base[1] + lc[1]) / 2, (mat.base[2] + lc[2]) / 2]
            : mat.base
          : lc;
        let n = norm(rot(pl.w[0], pl.w[1], pl.w[2]));
        const wTowardCam = n[2] < 0;
        if (n[2] > 0) n = [-n[0], -n[1], -n[2]];
        const diff = Math.max(0, n[0] * Ld[0] + n[1] * Ld[1] + n[2] * Ld[2]);
        const nh = Math.max(0, n[0] * Hd[0] + n[1] * Hd[1] + n[2] * Hd[2]);
        const faceCol: V3 = [
          base[0] * (lit.amb[0] + diff * lit.col[0] * 0.9),
          base[1] * (lit.amb[1] + diff * lit.col[1] * 0.9),
          base[2] * (lit.amb[2] + diff * lit.col[2] * 0.9),
        ];
        const sideCol: V3 = [faceCol[0] * 0.62, faceCol[1] * 0.62, faceCol[2] * 0.62];
        const fog = Math.max(0.5, Math.min(1, 1.05 - (centers[i][2] + 2) * 0.12));
        const sideA = (mat.clear ? Math.min(0.5, (mat.alpha * 2.2) / nl) : 1) * fog;
        const faceA = (mat.clear ? mat.alpha * 1.4 : 1) * fog;
        const edge = mat.edge * p.sharp;
        const rimCol: V3 = bright
          ? [faceCol[0] * 0.35, faceCol[1] * 0.35, faceCol[2] * 0.35]
          : [
              Math.min(1, 0.55 + lit.col[0] * 0.5),
              Math.min(1, 0.55 + lit.col[1] * 0.5),
              Math.min(1, 0.55 + lit.col[2] * 0.5),
            ];

        for (let k = 0; k < nl; k++) {
          const tt = nl === 1 ? 0 : k / (nl - 1);
          const lz = wTowardCam ? -pl.half + 2 * pl.half * tt : pl.half - 2 * pl.half * tt;
          const ox = pl.c[0] + pl.w[0] * lz,
            oy = pl.c[1] + pl.w[1] * lz,
            oz = pl.c[2] + pl.w[2] * lz;
          const O = P(ox, oy, oz);
          const U = P(ox + pl.u[0] * pl.s, oy + pl.u[1] * pl.s, oz + pl.u[2] * pl.s);
          const V = P(ox + pl.v[0] * pl.s, oy + pl.v[1] * pl.s, oz + pl.v[2] * pl.s);
          const ux = U[0] - O[0],
            uy = U[1] - O[1],
            vx = V[0] - O[0],
            vy = V[1] - O[1];
          const ul = Math.hypot(ux, uy) || 1;
          ctx.setTransform(
            (dpr * ux) / 64,
            (dpr * uy) / 64,
            (-dpr * vx) / 64,
            (-dpr * vy) / 64,
            dpr * O[0],
            dpr * O[1],
          );
          const isFace = k === nl - 1,
            isBack = k === 0;
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = rgba(isFace ? faceCol : sideCol, isFace ? faceA : sideA);
          ctx.fillText(l.ch, 0, 4);
          if ((isFace || isBack) && edge > 0.02) {
            ctx.lineJoin = "miter";
            ctx.lineWidth = ((isFace ? 1.3 : 0.8) * 64) / ul;
            ctx.strokeStyle = rgba(rimCol, edge * (isFace ? 0.95 : 0.4) * fog);
            ctx.strokeText(l.ch, 0, 4);
          }
          if (isFace && mat.spec > 0.05) {
            const ang = Math.atan2(n[1], n[0]) + v.yaw * 0.7 + i;
            const dx = Math.cos(ang) * 75,
              dy = Math.sin(ang) * 75;
            const gr = ctx.createLinearGradient(-dx, -dy, dx, dy);
            const strength = Math.min(1, (0.25 + Math.pow(nh, 8) * 1.2) * mat.spec) * fog;
            const bands = Math.max(1, mat.facets);
            const stops: [number, string][] = [
              [0, "rgba(0,0,0,0)"],
              [1, "rgba(0,0,0,0)"],
            ];
            for (let b = 0; b < bands; b++) {
              const pos0 =
                (hash(i * 13 + b * 7 + 3) + v.yaw * (0.15 + 0.1 * b) + v.pitch * 0.2) % 1;
              const pc = ((pos0 % 1) + 1) % 1;
              const wdt = bands === 1 ? 0.18 : 0.06;
              let sc: V3 = lit.col;
              if (mat.metal)
                sc = [
                  Math.min(1, base[0] * 1.2 + 0.2),
                  Math.min(1, base[1] * 1.2 + 0.2),
                  Math.min(1, base[2] * 1.2 + 0.2),
                ];
              else if (mat.prism) sc = hsl((pc * 720 + b * 60) % 360, 0.95, 0.72);
              const a = strength * (bands === 1 ? 0.55 : 0.85);
              stops.push(
                [Math.max(0.001, pc - wdt), rgba(sc, 0)],
                [pc, rgba(sc, a)],
                [Math.min(0.999, pc + wdt), rgba(sc, 0)],
              );
            }
            stops.sort((a, b) => a[0] - b[0]);
            stops.forEach(([o, c]) => gr.addColorStop(o, c));
            ctx.globalCompositeOperation = bright ? "source-over" : "lighter";
            ctx.fillStyle = gr;
            ctx.fillText(l.ch, 0, 4);
          }
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = ink + "0.6)";
      ctx.font = `12px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      p.letters.forEach((l, i) => {
        if (!pos[i].label) return;
        const c = centers[i];
        ctx.fillText(String(l.value), c[0], c[1] - (f / (c[2] + D)) * 0.45);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (live.current.locked) return;
    const v = view.current;
    v.drag = true;
    v.lx = e.clientX;
    v.ly = e.clientY;
    e.currentTarget.setPointerCapture(e.nativeEvent.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const v = view.current;
    if (!v.drag) return;
    v.yaw += (e.clientX - v.lx) * 0.01;
    v.pitch = Math.max(-1.55, Math.min(1.55, v.pitch + (e.clientY - v.ly) * 0.01));
    v.lx = e.clientX;
    v.ly = e.clientY;
  };
  const up = () => {
    view.current.drag = false;
  };

  return (
    <canvas
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="img"
      aria-label={`3D cipher of ${props.letters.map((l) => l.ch).join("")}. Drag to rotate.`}
      className="block h-[420px] w-full rounded-lg border border-border sm:h-[520px]"
      style={{ touchAction: "none", cursor: props.locked ? "default" : "grab" }}
    />
  );
}

type ViewProps = {
  letters: Letter[];
  mode: Mode;
  evolve: boolean;
  spin: boolean;
  resetKey: number;
  spinSpeed: number;
  evolveSpeed: number;
  locked: boolean;
  lockYaw: number;
  lockPitch: number;
  trail: boolean;
  fold: number;
  gap: number;
  material: MatKey;
  lighting: LightKey;
  sharp: number;
  colorByLetter: boolean;
  layers: number;
  font: FontKey;
};

/* ---------- site-styled controls (replace the grok/canvas kit) ---------- */

const labelText = "text-xs uppercase tracking-wide text-subtle";

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-fg sm:text-2xl">{heading}</h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function Row({ cols, children }: { cols: 2 | 3 | 4; children: ReactNode }) {
  const c =
    cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
  return <div className={cn("grid gap-4", c)}>{children}</div>;
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  big?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", props.disabled && "opacity-45")}>
      <label htmlFor={id} className="flex flex-wrap justify-between gap-2 text-sm text-muted">
        <span className={props.big ? "text-fg" : undefined}>{props.label}</span>
        <span className="font-mono text-fg">
          {props.value}
          {props.unit || ""}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={cn("w-full accent-[var(--color-gold)]", props.big ? "h-8" : "h-6")}
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-3 text-left text-sm text-fg hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors",
          value ? "border-accent bg-accent-dim" : "border-field-border bg-field",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full transition-[left]",
            value ? "left-[18px] bg-accent" : "left-0.5 bg-subtle",
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

function Picker<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelText}>
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        className="h-11 w-full rounded-md border border-field-border bg-field px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className={labelText} id={id}>
        {props.label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => props.onChange(o.value)}
              className={cn(
                "h-10 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                on
                  ? "border-accent bg-accent-dim text-fg"
                  : "border-border bg-surface text-muted hover:bg-raised hover:text-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

function prefersLessMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WayCipher() {
  const [calm] = useState(prefersLessMotion);
  const [text, setText] = useState("נפלים");
  const [mode, setMode] = useState<Mode>("fold");
  const [fold, setFold] = useState(0.8);
  const [gap, setGap] = useState(0.14);
  const [evolve, setEvolve] = useState(true);
  const [spin, setSpin] = useState(true);
  const [finals, setFinals] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [spinSpeed, setSpinSpeed] = useState(1);
  const [evolveSpeed, setEvolveSpeed] = useState(1);
  // Reduced motion: start frozen; the visitor raises Movement speed to start it.
  const [speed, setSpeed] = useState(calm ? 0 : 1);
  const [locked, setLocked] = useState(false);
  const [lockYaw, setLockYaw] = useState(0);
  const [lockPitch, setLockPitch] = useState(0);
  const [trail, setTrail] = useState(false);
  const [material, setMaterial] = useState<MatKey>("diamond");
  const [lighting, setLighting] = useState<LightKey>("golden");
  const [sharp, setSharp] = useState(0.8);
  const [colorByLetter, setColorByLetter] = useState(false);
  const [layers, setLayers] = useState(17);
  const [font, setFont] = useState<FontKey>("serif");
  const snap = (yaw: number, pitch: number) => {
    setLocked(true);
    setLockYaw(yaw);
    setLockPitch(pitch);
  };
  const letters = useMemo(() => parse(text, finals), [text, finals]);
  const total = letters.reduce((s, l) => s + l.value, 0);
  const matOptions = (Object.keys(MATS) as MatKey[]).map((k) => ({
    value: k,
    label: MATS[k].label,
  }));
  const lightOptions = (Object.keys(LIGHTS) as LightKey[]).map((k) => ({
    value: k,
    label: LIGHTS[k].label,
  }));
  const fontOptions = (Object.keys(FONTS) as FontKey[]).map((k) => ({ value: k, label: FONTS[k] }));
  const inputId = useId();

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">The Way</p>
      <h1 className="mt-2 font-display text-4xl text-fg sm:text-5xl">3D Hebrew Cipher</h1>
      <p className="mt-3 max-w-xl text-base text-muted">
        Type a Hebrew word and its letters fold, stack, or arrange into a 3D shape set by their
        number values and the golden angle. Drag to rotate.
      </p>

      <Section heading="Your word">
        <Row cols={2}>
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className={labelText}>
              Hebrew (or English) text
            </label>
            <Input
              id={inputId}
              dir="auto"
              lang="he"
              autoComplete="off"
              spellCheck={false}
              value={text}
              placeholder="נפלים"
              onChange={(e) => setText(e.target.value)}
              className="text-lg"
            />
          </div>
          <Segmented<Mode>
            label="Shape"
            options={[
              { value: "fold", label: "Protein fold" },
              { value: "stacked", label: "Stacked" },
              { value: "spiral", label: "Spiral" },
              { value: "sphere", label: "Sphere" },
              { value: "helix", label: "Helix" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </Row>
        <Row cols={4}>
          <Toggle label="Evolve over time" value={evolve} onChange={setEvolve} />
          <Toggle label="Auto spin" value={spin} onChange={setSpin} />
          <Toggle label="Final letters 500–900" value={finals} onChange={setFinals} />
          <Button variant="secondary" onClick={() => setResetKey((k) => k + 1)}>
            Reset view
          </Button>
        </Row>
      </Section>

      {letters.length > 0 ? (
        <Section heading={`Cipher shape · total value ${total}`}>
          <CipherView
            letters={letters}
            mode={mode}
            evolve={evolve}
            spin={spin}
            resetKey={resetKey}
            spinSpeed={spinSpeed * speed}
            evolveSpeed={evolveSpeed * speed}
            locked={locked}
            lockYaw={lockYaw}
            lockPitch={lockPitch}
            trail={trail}
            fold={fold}
            gap={gap}
            material={material}
            lighting={lighting}
            sharp={sharp}
            colorByLetter={colorByLetter}
            layers={layers}
            font={font}
          />
          <Slider
            big
            label="Movement speed (0 freezes everything)"
            value={speed}
            min={0}
            max={5}
            step={0.05}
            unit="×"
            onChange={setSpeed}
          />
          {calm && speed === 0 ? (
            <p className="text-sm text-subtle">
              Held still because your device asks for less motion. Slide Movement speed up to start
              it.
            </p>
          ) : null}
          <Row cols={2}>
            <Toggle label="Evolve over time" value={evolve} onChange={setEvolve} />
            <Toggle label="Auto spin" value={spin} onChange={setSpin} />
          </Row>
        </Section>
      ) : (
        <p className="mt-8 text-sm text-subtle">No Hebrew or English letters in that text yet.</p>
      )}

      <Section heading="Material and light">
        <Row cols={3}>
          <Picker<MatKey>
            label="Letter material"
            options={matOptions}
            value={material}
            onChange={setMaterial}
          />
          <Picker<LightKey>
            label="Lighting"
            options={lightOptions}
            value={lighting}
            onChange={setLighting}
          />
          <Picker<FontKey>
            label="Letter style"
            options={fontOptions}
            value={font}
            onChange={setFont}
          />
        </Row>
        <Row cols={3}>
          <Slider
            label="Edge sharpness"
            value={sharp}
            min={0}
            max={1}
            step={0.01}
            onChange={setSharp}
          />
          <Slider
            label="Depth slices per letter"
            value={layers}
            min={1}
            max={40}
            step={1}
            onChange={setLayers}
          />
          <Toggle
            label="Tint each letter by its value"
            value={colorByLetter}
            onChange={setColorByLetter}
          />
        </Row>
      </Section>

      {mode === "stacked" || mode === "fold" ? (
        <Section heading={mode === "fold" ? "Fold" : "Stack and fold"}>
          <Row cols={2}>
            <Slider
              label="Fold (how much each letter bends the chain)"
              value={fold}
              min={0}
              max={2}
              step={0.01}
              unit="×"
              onChange={setFold}
            />
            <Slider
              label="Spacing between letters"
              value={gap}
              min={0.02}
              max={0.4}
              step={0.01}
              onChange={setGap}
            />
          </Row>
        </Section>
      ) : null}

      <Section heading="Speed and angle">
        <Row cols={2}>
          <Slider
            label="Spin speed (negative spins backward)"
            value={spinSpeed}
            min={-3}
            max={3}
            step={0.05}
            unit="×"
            onChange={setSpinSpeed}
            disabled={locked}
          />
          <Slider
            label="Evolve speed"
            value={evolveSpeed}
            min={0}
            max={5}
            step={0.05}
            unit="×"
            onChange={setEvolveSpeed}
          />
        </Row>
        <Row cols={3}>
          <Toggle label="Lock the angle" value={locked} onChange={setLocked} />
          <Toggle label="Draw motion trails" value={trail} onChange={setTrail} />
          <Button variant="secondary" onClick={() => setResetKey((k) => k + 1)}>
            Clear trails
          </Button>
        </Row>
        <Row cols={2}>
          <Slider
            label="Turn (left / right)"
            value={lockYaw}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(v) => {
              setLocked(true);
              setLockYaw(v);
            }}
          />
          <Slider
            label="Tilt (up / down)"
            value={lockPitch}
            min={-90}
            max={90}
            step={1}
            unit="°"
            onChange={(v) => {
              setLocked(true);
              setLockPitch(v);
            }}
          />
        </Row>
        <Row cols={4}>
          <Button variant="secondary" onClick={() => snap(0, 0)}>
            Front
          </Button>
          <Button variant="secondary" onClick={() => snap(90, 0)}>
            Side
          </Button>
          <Button variant="secondary" onClick={() => snap(0, 90)}>
            Top down
          </Button>
          <Button variant="secondary" onClick={() => snap(45, 35)}>
            Corner
          </Button>
        </Row>
      </Section>

      {letters.length > 0 ? (
        <Section heading="Letters and values">
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Letter
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {letters.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-subtle">{i + 1}</td>
                    <td
                      className="px-3 py-2 font-serif text-xl text-fg"
                      lang={l.name.startsWith("Latin") ? "en" : "he"}
                    >
                      {l.ch}
                    </td>
                    <td className="px-3 py-2 text-muted">{l.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-fg">{l.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section heading="How the shape is computed">
        <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Each letter is drawn as a real, smooth letter shape and given depth by stacking thin
            copies of it, like the slices of a stacked sprite. The depth slices slider sets how
            many, 17 by default.
          </p>
          <p>
            Protein fold treats the word like a chain of amino acids. Each letter is one link,
            standing crosswise to the chain. At every link the chain bends by an amount set by that
            letter&apos;s value, then twists by its value times the golden angle. The twists add up
            along the chain, so the word folds into a shape that belongs to it alone. With Evolve
            on, the chain slowly unfolds into a straight column and folds back up.
          </p>
          <p>
            In Stacked mode the letters lie flat and pile up, each turning by its value times the
            golden angle on top of the turns below it. Spiral, Sphere and Helix float the letters
            apart, with each letter&apos;s value setting how high or how far out it sits.
          </p>
          <p>
            Glass and gems are see-through with crisp bright rims, and light bands sweep across
            their faces as they turn. Diamond splits those bands into rainbow colors, gold reflects
            in its own color, and the lighting sets the sky and the color of the light.
          </p>
        </div>
      </Section>
    </div>
  );
}

export default WayCipher;
