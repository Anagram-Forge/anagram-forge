# Backlog

Not started. Pick one when we want it.

## Disclaimers — usage, privacy, ethics

Want them findable without a cookie-wall or a lecture on first paint.

Leaning: quiet links in the top bar (`usage · privacy · ethics`) that open a single short panel, not three legal PDFs. Open to other shapes.

## Repentance flag

A very small swipeable tab on the right edge, same gold as the verse theme labels (`#d4a24c`). Pull it and it reads:

> Turn from your sin and come to Christ. Nothing else in this life outranks that.

Keep it pull-to-reveal, not a popup.

## Copy this solve

A obvious button that copies a shareable link for the current rack (`?q=listen` and friends). Search params already exist; make “send this one to someone” one click.

## Background music

A small music-note toggle. Inspiration only — do **not** rip artists from YouTube playlists. See notes in chat: free/CC or a paid web license, hosted by us.

## Security checkup

Do this on a cadence, not in a panic.

- The mail worker still has Cloudflare’s default `*.workers.dev` URL. Optional: custom domain + refuse that Host. Visitors never see it today.
- Rotate any token that was ever pasted in chat
- Confirm WHOIS privacy still on (Cloudflare Registrar — already obfuscated)
- GitHub org profile stays boring (no legal name / personal email)
- Quick grep of the public repo for mail addresses, keys, tokens

First pass when we feel like it. Then maybe every 90 days, same as the GitHub token reminder.

## Site stats / humans vs bots

Quiet dashboard near the ad/support slot: visitors, anagrams forged, a few other numbers.

Use **Cloudflare Web Analytics with bot filtering** when we want “how many humans,” not raw requests. The account analytics chart (requests / visits / countries) counts crawlers. Don’t treat Germany-at-3am as a fan club.

## Learn SEO

Walk through what actually matters for a small site like this (title, description, share card, sitemap, speed) without turning it into a marketing class. Do this before chasing rankings.

## Custom 404

Need a real “this page does not exist” page. Make it unique — brainstorm in chat before building. Should still be kind, not a jump-scare.

## Accessibility (ADA)

Design for more than average vision and reading.

- Dyslexia-friendly type (Lexend, Atkinson Hyperlegible, or OpenDyslexic) as an **option**, not a force-replace of the current display font
- Contrast, focus rings, keyboard, screen readers
- Discuss as its own pass so we don’t bolt a font on and call it done

## Later (already mentioned)

- Voting / ranking of favorite finds (needs a database)
- Save query / saved searches — after usage / ToS is in place
- Sign-in when we actually need it
