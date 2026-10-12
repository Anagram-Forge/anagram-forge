export const SITE = "https://anagramforge.com";
export const SITE_NAME = "Anagram Forge";
export const DESCRIPTION =
  "Unscramble letters into words and phrases. Exact anagrams, rack words, crossword patterns, blanks, and Scrabble scores.";
export const OG_IMAGE = `${SITE}/og-image.png`;

const TITLES: Record<string, string> = {
  "/": "Anagram Forge — unscramble letters into words and phrases",
  "/finds": "Finds — Anagram Forge",
  "/archive": "Archive — Anagram Forge",
  "/saved": "Saved — Anagram Forge",
  "/enter": "Enter — Anagram Forge",
};

export function titleFor(path: string) {
  return TITLES[path] ?? SITE_NAME;
}

export function pageUrl(path: string) {
  if (!path || path === "/") return `${SITE}/`;
  return `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Share tags for one public URL. Same words as the page, no tracking. */
export function shareMeta(path: string) {
  const title = titleFor(path);
  const url = pageUrl(path);
  return {
    meta: [
      { title },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: title },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: url },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
