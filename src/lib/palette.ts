/** Five inks. Shades under a hue are not new colors. Canvas, SVG, and CSS keep these hexes. */

export const inks = {
  soot: "#0c0b0a",
  bone: "#ebe4d6",
  gold: "#d4a24c",
  iron: "#c45c4a",
  ember: "#ff6a1a",
} as const;

export const soot = {
  bg: "#0c0b0a",
  surface: "#141210",
  raised: "#1c1916",
  field: "#2a2620",
  border: "#2c2823",
  fieldBorder: "#4a453c",
  subtle: "#6e685e",
  muted: "#9c9588",
} as const;

export const bone = {
  tile: "#ebe4d6",
  fg: "#f3efe6",
} as const;

export const gold = {
  accent: "#d4a24c",
  fg: "#1a1308",
  dim: "#3a2c14",
  hot: "#ffe08a",
} as const;

/** Anvil burst + sky mote. One cycle, not new inks. */
export const sparkCycle = [bone.fg, gold.hot, inks.gold, inks.ember, inks.gold, inks.ember, bone.fg] as const;

export function rgba(hex: string, a: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
