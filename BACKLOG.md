# Backlog

Not started. Pick one when we want it.

## Learn SEO

Title, description, share card, sitemap, speed. A lesson, then maybe three tags. Do this before chasing rankings.

## Accessibility (ADA)

Aa / easier type exists. Still owed: contrast, focus rings, keyboard, screen readers as their own pass.

## Background music

A small music-note toggle. Free/CC or a paid web license, hosted by us. Do **not** rip YouTube playlists.

## Security checkup

Cadence, not panic. About every 90 days (GitHub PAT window).

- **Audit 2026-08-23** — PAT still in old chat; grep public repo; mail worker hostname; WHOIS; rotate anything pasted
- `DOOR_HASH` (and later `DOOR_HASH_*`) live only in Cloudflare Variables and secrets — never git
- Mail worker still on `*.workers.dev` — visitors never see it; optional custom domain
- Rotate any token that was ever pasted in chat
- WHOIS privacy (Cloudflare Registrar)
- GitHub org stays boring (no legal name / personal email)
- Grep the public repo for mail addresses, keys, tokens

## Humans vs bots

Cloudflare Web Analytics with **bot filtering** when we want “how many humans,” not Germany-at-3am crawlers. Footer visits stay the honest-enough number.

## Solid maybe

- **Other languages** — Spanish first if ever. Generalize the 26-letter rack, new word list, language scores. UI stays English until the solver isn’t lying. Not CJK/Arabic/Hebrew.
- Drop `FORGE_ADMIN` once `keeper` is the live steward handle
- CSV of a rack’s finds
- 404 that’s an anagram joke (“the letters are missing”) — **shipped.** Optional: match the hero type, “use these letters” button
- Anvil silhouette (user will tweak)
- **Strike sparks as verses** — default = original metal streaks. Rare (~1 in 4) **iron / sharpens / iron**. Rarer (~1 in 12) **crucible / furnace / gold**. Reduced-motion: skip. **In preview.**

## Side quests (hidden page)

Gate: rack → exact phrase in order → Make a card. Signature is the link. Copy is server-gated (`/api/forge/door`, cookie `af_doors`). Add a later gate with another secret `DOOR_HASH_NAME` plus a vault entry — matcher already loops them. Do **not** put unlock phrases in this file. **Real lock in preview.**

## Card looks (pick of 3)

1. **Vintage postcard** — aged stock, stamp, hairline border, handwritten feel
2. **Index card + Bible doodles** — ruled stock, small story sketches in the margin
3. **Letterpress type-foundry proof** — third option: cotton paper, bite of ink, a gold-foil word. Rhymes with the forge (hot metal type) and with the other two (analog paper, not a neon UI card).

