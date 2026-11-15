const DET = new Set(["a", "an", "the", "my", "our", "his", "her", "its", "their", "your"]);
const COPULA = new Set(["is", "am", "are", "was", "were", "be"]);
const PREP = new Set(["of", "to", "in", "on", "for", "with", "from", "by", "at", "as", "into", "over", "up"]);
const CONJ = new Set(["and", "or", "but", "nor"]);

function glue(w: string): boolean {
  return DET.has(w) || COPULA.has(w) || PREP.has(w) || CONJ.has(w);
}

function readingScore(seq: string[], freq: Map<string, number>): number {
  const n = seq.length;
  let s = 0;
  let known = 0;
  let weakest = Infinity;
  for (const w of seq) {
    const f = freq.get(w) ?? 0;
    if (f <= 0) s -= 80;
    else {
      known++;
      weakest = Math.min(weakest, f);
      s += Math.log2(f + 1);
    }
  }
  if (known === n) s += 40;
  if (weakest < Infinity) s += Math.log2(weakest + 1) * 3;

  for (let i = 0; i < n; i++) {
    const w = seq[i]!;
    const f = freq.get(w) ?? 0;
    if (COPULA.has(w) && i > 0 && i < n - 1) s += 18;
    if (COPULA.has(w) && (i === 0 || i === n - 1)) s -= 12;
    if (DET.has(w) && i === 0) s += 10;
    if (DET.has(w) && i === n - 1) s -= 10;
    if (PREP.has(w) && i > 0 && i < n - 1) s += 8;
    if (PREP.has(w) && (i === 0 || i === n - 1)) s -= 8;
    if (i > 0 && COPULA.has(seq[i - 1]!) && f > 0) s += Math.log2(f + 1);
    if (i > 0 && glue(seq[i - 1]!) && glue(w)) s -= 6;
  }
  if (n > 1 && seq.every(glue)) s -= 24;
  if (n === 2 && !seq.some(glue)) {
    const a = freq.get(seq[0]!) ?? 0;
    const b = freq.get(seq[1]!) ?? 0;
    if (a > b) s -= 2;
  }
  return s;
}

export function bestReading(
  words: string[],
  freq: Map<string, number>,
): { score: number; order: string[] } {
  const n = words.length;
  if (n <= 1) return { score: readingScore(words, freq), order: words.slice() };

  let best = -Infinity;
  let bestOrder = words;
  const used = new Array<boolean>(n).fill(false);
  const cur: number[] = [];

  function walk() {
    if (cur.length === n) {
      const seq = cur.map((i) => words[i]!);
      const s = readingScore(seq, freq);
      if (s > best || (s === best && seq.join(" ") < bestOrder.join(" "))) {
        best = s;
        bestOrder = seq;
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      walk();
      cur.pop();
      used[i] = false;
    }
  }
  walk();
  return { score: best, order: bestOrder };
}
