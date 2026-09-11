# Backlog

Not started. Pick one when we want it.

## Learn SEO

Title, description, share card, sitemap, speed. A lesson, then maybe three tags. Do this before chasing rankings.

## Accessibility (ADA)

Aa / easier type exists. Still owed: contrast, focus rings, keyboard, screen readers as their own pass.

## Background music

Note: first click plays (no panel). Hover after that for a tiny mixer — skip, pause, volume, AlkaKrab link. No track list. Pack gitignored; R2 before production.

## Security checkup

Cadence, not panic. About every 90 days (GitHub PAT window).

- **Audit 2026-08-23** — PAT still in old chat; grep public repo; mail worker hostname; WHOIS; rotate anything pasted
- `DOOR_HASH` (and later `DOOR_HASH_*`) live only in Cloudflare Variables and secrets — never git
- Mail worker still on `*.workers.dev` — visitors never see it; optional custom domain
- R2 bucket `anagram-forge-media` holds AlkaKrab beds (not git). Roll the R2 API token; it was pasted in chat.
- Rotate any token that was ever pasted in chat
- WHOIS privacy (Cloudflare Registrar)
- GitHub org stays boring (no legal name / personal email)
- Grep the public repo for mail addresses, keys, tokens

## Humans vs bots

Cloudflare Web Analytics with **bot filtering** when we want “how many humans,” not Germany-at-3am crawlers. Footer visits stay the honest-enough number.

## Solid maybe

- **Other languages** — Spanish first if ever. Generalize the 26-letter rack, new word list, language scores. UI stays English until the solver isn’t lying. Not CJK/Arabic/Hebrew.
- CSV of a rack’s finds
- 404 that’s an anagram joke (“the letters are missing”) — **shipped.** Optional: match the hero type, “use these letters” button
- Anvil silhouette (user will tweak)
- **Strike sparks as verses** — default = original metal streaks. Rare (~1 in 4) **iron / sharpens / iron**. Rarer (~1 in 12) **crucible / furnace / gold**. Reduced-motion: skip.
- **Rare strikes, more distinct** — verse/gold bursts need a subtler tell vs normal sparks (slower flight is one option; also: linger, slightly larger type, quieter extra ping). Open.
- **Muted rare-strike sound** — a quieter hammer ping (or a different sample) when the verse/gold burst fires, so it reads as rare without a louder hit. Steward spark-range is for previewing bursts, not the sound.
- **Constellation sparks** — gold motes that drift letter-to-letter in the background anagram sky. Must stay rare/slow so it doesn’t fight the solver. Think first; don’t crank motion.

## Side quests (hidden page)

Gate: rack → exact phrase in order → Make a card. Signature is the link. Copy is server-gated (`/api/forge/door`, cookie `af_doors`). Add a later gate with another secret `DOOR_HASH_NAME` plus a vault entry — matcher already loops them. Do **not** put unlock phrases in this file. Title/signature: **The Way**. Steward visit tracker: **shipped** (cookie-gated, not the public footer).

- **Trail for the first clue** — visitors need a hint or breadcrumb toward the first door (the rack + exact arrangement). Quiet, not a spoiler on the homepage. Open.

## Must-contain → theme heat

Rejuvenate the “must contain” box so it can also be a **free-form theme**, not only a required substring.

- Example: rack solve, type `rattlesnake` in the box. Results stay legal for the rack, but **sort and color hot → cold** by how close each word/phrase is to that theme.
- One word or a short phrase in the box is enough.
- Existing “must include these letters” behavior stays available — don’t silently replace it. Split, toggle, or a second field; decide when we build.
- Color is a quiet heat scale (not neon). Accessible (not color-only).
- Thematic scoring is the hard part (embeddings vs a small local related-words list vs a tiny worker). Pick the cheap client-side path first.

## Top 3 perfect anagrams

Suggest the best **complete** anagrams of the typed rack (every letter used, leftover = 0). Show three, ranked.

- Not “first 160 phrase dumps.” Hunt for good ones: common words, few words, don’t just reshuffle the input.
- `eleven plus two` → `twelve plus one` is the gold standard (aptagram / anagrammatic equation). Taste is the hard part; search is medium.
- Short racks: cheap, in-browser. Long names: beam/best-first with a time budget so the page never freezes. Same machine-not-ours rule.
- UI: a quiet top-3 above the banks. Click → picked, ready for a postcard.
- First pass can skip when it can’t finish clean.

## Card looks (pick of 3)

1. **Vintage postcard** — aged stock, stamp, hairline border, handwritten feel
2. **Index card + Bible doodles** — ruled stock, small story sketches in the margin
3. **Letterpress type-foundry proof** — third option: cotton paper, bite of ink, a gold-foil word. Rhymes with the forge (hot metal type) and with the other two (analog paper, not a neon UI card).

