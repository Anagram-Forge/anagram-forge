let hit: HTMLAudioElement | null = null;

export function warmRing() {
  if (typeof window === "undefined") return;
  if (!hit) {
    hit = new Audio("/sounds/anvil-hit.mp3");
    hit.preload = "auto";
    hit.volume = 0.85;
  }
}

export function strikePing() {
  warmRing();
  if (!hit) return;
  hit.currentTime = 0;
  void hit.play().catch(() => {
    /* autoplay until a gesture — drag counts */
  });
}

export function hitsAnvil(hammer: DOMRect) {
  const anvil = document.getElementById("forge-anvil");
  if (!anvil) return null;
  const a = anvil.getBoundingClientRect();
  const hx = hammer.left + hammer.width * 0.48;
  const hy = hammer.top + hammer.height * 0.28;
  const pad = 10;
  if (hx < a.left - pad || hx > a.right + pad || hy < a.top - pad || hy > a.bottom + pad) return null;
  return { x: a.left + a.width / 2, y: a.top + a.height * 0.35 };
}

export function parkedHammerPos() {
  const anvil = document.getElementById("forge-anvil");
  if (!anvil) return null;
  const a = anvil.getBoundingClientRect();
  return { x: a.left + a.width * 0.52, y: a.top - 18 };
}
