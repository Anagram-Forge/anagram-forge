# Ship Anagram Forge

You need: a GitHub repo and a Cloudflare account (Pages). Domain can wait.

## 1. Create the GitHub repo

1. Open [github.com/new](https://github.com/new)
2. Repository name: `anagram-forge` (or whatever you like)
3. Public
4. **Do not** add a README, .gitignore, or license (empty repo)
5. Create repository
6. Copy the URL. It looks like `https://github.com/YOURNAME/anagram-forge`

Tell me that URL. I can prepare the first commit here; to *push* it we either:

- you upload the project zip I give you on the repo’s **Add file → Upload files** page, or
- you create a GitHub **personal access token** (repo scope) and paste it once so I can push from this chat (you can revoke it after)

## 2. Connect Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Authorize GitHub if asked
3. Pick `anagram-forge`
4. Settings:

   | Field | Value |
   | --- | --- |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `.output/public` |
   | Root directory | `/` (leave default) |
   | Node version | `22` (Environment variables → `NODE_VERSION` = `22`) |

5. **Save and Deploy**

Cloudflare sets `CF_PAGES=1` during the build so this app targets Pages instead of Vercel. No other env vars needed for the solver.

First deploy takes a couple of minutes. You get `https://anagram-forge.pages.dev` (or similar).

## 3. Domain later

When the name is yours: Pages project → **Custom domains** → add it. Cloudflare will show the DNS records if the domain lives somewhere else, or attach it automatically if you bought it at Cloudflare.

## What this first ship includes

Solver, picker, cards, sponsor form (inbox still unconnected). Sign-in / Saved stay hidden until we turn them on.
