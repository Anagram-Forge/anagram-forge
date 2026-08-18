const A = 97;

export function normalizeLetters(raw: string): { letters: string; blanks: number } {
  let blanks = 0;
  const out: string[] = [];
  for (const ch of raw.toLowerCase()) {
    if (ch === "?" || ch === "." || ch === "_") {
      blanks += 1;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= A && code < A + 26) out.push(ch);
  }
  return { letters: out.join(""), blanks };
}

export function countsOf(word: string): Uint8Array {
  const c = new Uint8Array(26);
  for (let i = 0; i < word.length; i++) {
    const n = word.charCodeAt(i) - A;
    if (n >= 0 && n < 26) c[n] += 1;
  }
  return c;
}

export function canSpell(need: Uint8Array, have: Uint8Array, blanks: number): boolean {
  let miss = 0;
  for (let i = 0; i < 26; i++) {
    if (need[i] > have[i]) {
      miss += need[i] - have[i];
      if (miss > blanks) return false;
    }
  }
  return true;
}

export function leftoverLetters(have: Uint8Array, used: Uint8Array): string {
  const chars: string[] = [];
  for (let i = 0; i < 26; i++) {
    const left = have[i] - used[i];
    for (let n = 0; n < left; n++) chars.push(String.fromCharCode(A + i));
  }
  return chars.join("");
}

export function consume(have: Uint8Array, need: Uint8Array): number {
  let usedBlanks = 0;
  for (let i = 0; i < 26; i++) {
    if (need[i] <= have[i]) {
      have[i] -= need[i];
    } else {
      usedBlanks += need[i] - have[i];
      have[i] = 0;
    }
  }
  return usedBlanks;
}

export function restore(have: Uint8Array, need: Uint8Array) {
  for (let i = 0; i < 26; i++) have[i] += need[i];
}

/** Undo consume when blanks filled missing letters (restore over-adds those). */
export function restoreConsumed(before: Uint8Array, have: Uint8Array) {
  have.set(before);
}

export function totalCount(c: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < 26; i++) n += c[i];
  return n;
}

export function lettersFromCounts(have: Uint8Array, blanks = 0): string {
  const chars: string[] = [];
  for (let i = 0; i < 26; i++) {
    for (let n = 0; n < have[i]; n++) chars.push(String.fromCharCode(A + i));
  }
  return chars.join("") + "?".repeat(blanks);
}

export function consumePicks(
  letters: string,
  blanks: number,
  picks: string[],
): { have: Uint8Array; blanks: number; leftover: string; ok: boolean } {
  const have = countsOf(letters);
  let blanksLeft = blanks;
  for (const word of picks) {
    const need = countsOf(word);
    if (!canSpell(need, have, blanksLeft)) {
      return {
        have,
        blanks: blanksLeft,
        leftover: lettersFromCounts(have, blanksLeft),
        ok: false,
      };
    }
    blanksLeft -= consume(have, need);
  }
  return {
    have,
    blanks: blanksLeft,
    leftover: lettersFromCounts(have, blanksLeft),
    ok: true,
  };
}

export function isOneLetterWord(word: string): boolean {
  return word === "a" || word === "i";
}

export function patternToRegex(pattern: string): RegExp | null {
  const p = pattern.trim().toLowerCase();
  if (!p) return null;
  let src = "^";
  for (const ch of p) {
    if (ch === "?" || ch === ".") src += "[a-z]";
    else if (ch === "*") src += "[a-z]*";
    else if (ch.charCodeAt(0) >= A && ch.charCodeAt(0) < A + 26) src += ch;
    else if (ch === " ") continue;
    else return null;
  }
  src += "$";
  try {
    return new RegExp(src);
  } catch {
    return null;
  }
}

export function onlyLetters(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) {
    const n = ch.charCodeAt(0) - A;
    if (n >= 0 && n < 26) out += ch;
  }
  return out;
}
