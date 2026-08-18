const SCRABBLE: number[] = (() => {
  const pts: Record<string, number> = {
    a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1,
    m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8,
    y: 4, z: 10,
  };
  const arr = new Array<number>(26);
  for (let i = 0; i < 26; i++) arr[i] = pts[String.fromCharCode(97 + i)] ?? 0;
  return arr;
})();

export function scrabbleScore(word: string): number {
  let n = 0;
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i) - 97;
    if (c >= 0 && c < 26) n += SCRABBLE[c];
  }
  return n;
}

export const TWO_LETTER = [
  "aa", "ab", "ad", "ae", "ag", "ah", "ai", "al", "am", "an", "ar", "as", "at", "aw", "ax", "ay",
  "ba", "be", "bi", "bo", "by",
  "da", "de", "do",
  "ed", "ef", "eh", "el", "em", "en", "er", "es", "et", "ew", "ex",
  "fa", "fe",
  "gi", "go",
  "ha", "he", "hi", "hm", "ho",
  "id", "if", "in", "is", "it",
  "jo",
  "ka", "ki",
  "la", "li", "lo",
  "ma", "me", "mi", "mm", "mo", "mu", "my",
  "na", "ne", "no", "nu",
  "od", "oe", "of", "oh", "oi", "ok", "om", "on", "op", "or", "os", "ow", "ox", "oy",
  "pa", "pe", "pi", "po",
  "qi",
  "re",
  "sh", "si", "so",
  "ta", "te", "ti", "to",
  "uh", "um", "un", "up", "us", "ut",
  "we", "wo",
  "xi", "xu",
  "ya", "ye", "yo",
  "za",
];
