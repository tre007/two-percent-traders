# 2% Traders - Live Board

> Live market board for a small Discord community. Real-time prices via Finnhub, 7-day trend sparklines via Twelve Data, content (watchlist thesis + weekly deep dives + archive) edited from a phone via Google Sheets. Deployed on Vercel.

**Live site:** https://two-percent-traders.vercel.app

---

## What it does

- **Live scoreboard** -- 12 tickers covering stocks, commodities, crypto, and dollar/volatility indexes. Prices auto-refresh every 30 seconds. 8 of them show 7-day sparkline trends next to the price.
- **Watchlist** -- 15+ tickers the group is tracking, each with a 1-2 sentence thesis. Supports manual price overrides for things the live API can't track (spot gold, physical silver, oil per barrel).
- **Weekly Deep Dive** -- featured long-form post rendered as the bottom hero section. Links back to the original Discord post.
- **Archive** -- expandable list of past Deep Dives. Click to read the summary, click the link to read the full post on Discord.
- **Live content pipeline** -- the entire watchlist + deep dive + archive is edited from a Google Sheet. No code changes required for weekly updates.
- **Secret button** -- there's an easter egg in the footer. Don't press it.

---

## Stack

- **Vite + React 18 + Tailwind CSS** on the frontend (single-page, one scroll)
- **Vercel serverless functions** for all API routes
- **Finnhub free tier** for live price quotes (30s refresh)
- **Twelve Data free tier** for 7-day sparkline history (cached 10 min edge)
- **Google Sheets (published CSV)** for content that changes weekly
- **Deployed to Vercel** with auto-deploy on every `main` commit

---

## Folder structure

```
src/
  App.jsx              UI code -- scoreboard, watchlist, deep dive, archive, footer
  data.js              Fallback content + scoreboard tickers + Discord URL
  useLivePrices.js     React hook, refreshes prices every 30s
  useLiveContent.js    React hook, reads from Google Sheets on page load
  useSparklines.js     React hook, fetches 7-day history once on mount

api/
  prices.js            Serverless function, fetches Finnhub live prices
  content.js           Serverless function, parses Google Sheets CSV
  sparklines.js        Serverless function, fetches Twelve Data 7d history

public/
  logo-icon.svg            Full badge logo (for social, favicon sources)
  logo-icon-header.svg     Simplified logo (ring + 2% + EST 2021), used in header
  logo-primary.svg         Logo with wordmark
  logo-hero-1024.png       Social card / OG image
  favicon-32.png           Browser tab favicon
  favicon-192.png          Mobile home screen favicon
  gorilla.jpg              Easter egg image

index.html           Page shell, meta tags, OG tags
tailwind.config.js   Brand colors (brand-amber, brand-dark) and font tokens
```

---

## Deployment setup

### Required environment variables in Vercel

| Name | Purpose |
|---|---|
| `FINNHUB_API_KEY` | Live prices. Free tier at finnhub.io |
| `TWELVEDATA_API_KEY` | 7-day sparkline history. Free tier at twelvedata.com |
| `GOOGLE_PUBLISH_ID` | The `2PACX-...` ID from File > Publish to web |
| `GOOGLE_WATCHLIST_GID` | Numeric tab ID for the watchlist tab |
| `GOOGLE_DEEPDIVE_GID` | Numeric tab ID for the deepdive tab |

All five must be set in Production AND Preview environments. After changing any env var, Vercel requires a new deployment to pick it up.

### Google Sheet structure

**Tab `watchlist`** -- columns: `symbol`, `name`, `thesis`, `price` (optional)
- One row per ticker
- `price` column is optional. When filled, site uses that value instead of live API (useful for spot gold, oil, etc.)

**Tab `deepdive`** -- columns: `issue`, `date`, `title`, `summary`, `discordUrl`
- Row 2 (first data row) = current featured Deep Dive
- Rows 3+ = archive, newest first
- To update weekly: right-click row 2 > Insert 1 row above > fill in new content. Old post automatically becomes archive.

Both tabs must be published via File > Share > Publish to web, format "Comma-separated values (.csv)". Use the GID from the published URL for the env var.

---

## Weekly content workflow

1. Open Google Sheet on phone
2. Go to `deepdive` tab
3. Right-click row 2 > Insert 1 row above
4. Fill in 5 columns: issue, date, title, summary, discordUrl
5. Save. Wait ~5 min for edge cache to clear. Site updates.

To update a watchlist thesis, just edit the `thesis` column in the `watchlist` tab. Same 5-minute cache.

---

## Local development

```bash
npm install
npm run dev       # starts Vite at localhost:5173
npm run build     # production build to dist/
```

Local development won't hit the serverless functions unless you run `vercel dev` instead of `npm run dev`. For UI work, the app falls back to the values in `src/data.js` if the APIs are unreachable.

---

## Design notes

- **Pure black background** (`bg-black`). Amber brand accents pop harder against it than against dark gray.
- **Font pairing:** Instrument Serif italic for editorial moments, Archivo sans-serif for UI, JetBrains Mono for data.
- **Brand amber:** `#d4a256` -- warm gold, slightly desaturated. Used for logo, ticker labels, section dividers, CTAs.
- **Card background on scoreboard:** subtle amber gradient (`rgba(212, 162, 86, 0.06)`) keeps cards readable on pure black.
- **Mobile-first.** Everything scales down cleanly. Header logo shrinks to 64px on mobile, 80px on desktop.

---

## Known constraints

- **Twelve Data free tier is 8 credits/minute.** Sparklines are intentionally limited to 8 tickers (SPY, QQQ, GLD, SLV, GDX, XLE, BTC, ETH). The other 4 scoreboard tickers render without a trend line.
- **Finnhub free tier dropped `/stock/candle`** (that's why sparklines use Twelve Data).
- **No live oil spot price** on free tiers that can be accessed reliably. OIL card in the watchlist uses a manual price updated weekly.
- **Edge cache on /api/content is 5 minutes.** Sheet edits don't appear instantly.
- **Browser storage APIs are not used anywhere** -- all state is in-memory per session.

---

## Built with Claude

This entire project, start to ship, was built in one weekend session with Claude Opus as a technical co-founder. Zero prior web dev experience required. If you want to build something like this and don't know how, that's the move.

---

*Not financial advice. Stay frosty.*
