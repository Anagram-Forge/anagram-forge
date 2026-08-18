export type SolveMode = "from-rack" | "exact" | "phrase" | "pattern";
export type SortKey = "length" | "score" | "alpha" | "common" | "rare" | "theme";
export type DictTier = "common" | "standard" | "full";

export type Filters = {
  minLen: number;
  maxLen: number;
  startsWith: string;
  endsWith: string;
  contains: string;
  exclude: string;
  minScore: number;
};

export type WordHit = {
  word: string;
  score: number;
  freq: number;
  leftover: string;
  themeHit?: boolean;
};

export type PhraseHit = {
  words: string[];
  score: number;
  leftover: string;
  locked?: string[];
  themeScore?: number;
};

export type SolveQuery = {
  letters: string;
  pattern: string;
  mode: SolveMode;
  dict: DictTier;
  sort: SortKey;
  filters: Filters;
  blanks: number;
  maxWords: number;
  phraseMinLen: number;
};

export const defaultFilters = (): Filters => ({
  minLen: 2,
  maxLen: 21,
  startsWith: "",
  endsWith: "",
  contains: "",
  exclude: "",
  minScore: 0,
});
