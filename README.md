# 2% Traders · Live Board

Live market board for your Discord community. Real prices via Finnhub. Content (watchlist thesis + weekly deep dive) edited from your phone via Google Sheets.

**Stage 4 of 5.** Now has live prices AND live content.

---

## Folder structure

- **`src/App.jsx`** — the UI code
- **`src/data.js`** — fallback content + scoreboard tickers + Discord link
- **`src/useLivePrices.js`** — React hook for prices (refreshes every 30s)
- **`src/useLiveContent.js`** — React hook for content (refreshes on page load)
- **`api/prices.js`** — serverless function calling Finnhub
- **`api/content.js`** — serverless function fetching Google Sheets
- **`public/`** — logos and favicons
- **`sheet_templates/`** — CSV templates to paste into Google Sheets on first setup

---

## Full deployment setup

You need two Vercel environment variables:

| Variable | Value | How to get it |
|---|---|---|
| `FINNHUB_API_KEY` | your Finnhub API key | finnhub.io dashboard |
| `GOOGLE_SHEET_ID` | your Google Sheet ID | see below |

### Step 1: Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → blank sheet
2. Name the first tab exactly **`watchlist`** (case-sensitive)
3. Open `sheet_templates/watchlist.csv` from this project, copy everything, paste into A1 → choose "split text into columns" if prompted
4. At the bottom, click + to add a second tab. Name it **`deepdive`** (one word, lowercase)
5. Open `sheet_templates/deepdive.csv`, copy everything, paste into A1

### Step 2: Make it public (read-only)

The function reads the sheet anonymously. This is only possible if sharing is set to "Anyone with the link".

1. File → Share → "General access" → change to **Anyone with the link** → **Viewer**
2. Copy the URL from your browser. It looks like:
   `https://docs.google.com/spreadsheets/d/`**`1A2B3c4D5eF6g7H8iJ9k0LMN`**`/edit#gid=0`
3. The bolded part (between `/d/` and `/edit`) is your **Sheet ID**

### Step 3: Add both env vars to Vercel

Vercel → your project → Settings → Environment Variables:

- `FINNHUB_API_KEY` = your Finnhub key
- `GOOGLE_SHEET_ID` = the ID you just copied

Check all three environments (Production, Preview, Development). Redeploy.

### Step 4: Verify

Open your live URL. You should see:
- Scoreboard with real prices
- Watchlist rendered from your Sheet
- Deep dive from your Sheet
- Status bar: `LIVE // UPDATED [time] CT // AUTO-REFRESH 30S`

---

## How to update content going forward

### Watchlist thesis

Open the sheet (phone or desktop). Edit the `thesis` column on any row. Save.

Site picks it up within 5 minutes (edge cache). To force an immediate refresh, hard-reload your site after a minute or so.

### Weekly deep dive

Open the `deepdive` tab. One row, five columns. Just overwrite:
- `issue` — the week number (15, 16, 17...)
- `date` — e.g. `APRIL 30, 2026`
- `title` — the headline (keep it short, it's displayed at 48px)
- `summary` — 2-3 sentences. Avoid line breaks.
- `discordUrl` — right-click the Discord message → Copy Message Link

### Add/remove watchlist tickers

Add a row with `symbol`, `name`, `thesis`.

For prices to show up, the symbol also needs to be in `api/prices.js` → `TICKER_MAP`. If you add a new ticker that isn't in the map, the card renders but price shows `—`.

---

## What's still edited in code (not Sheets)

- **Scoreboard tickers** (`src/data.js`) — these almost never change
- **Discord invite URL** (`src/data.js`) — one-time setting
- **Ticker-to-Finnhub mapping** (`api/prices.js`) — only touched when adding a new ticker

---

## Local development

Same as before. `vercel dev` if you want the API functions to work locally, else `npm run dev` and the UI gracefully falls back to `data.js` values.

---

## Troubleshooting

**Watchlist shows data.js values, not Sheets values**
- Sheet isn't public. Re-check "Anyone with the link" is set
- `GOOGLE_SHEET_ID` env var is wrong or missing in Vercel
- Tab names are wrong — they must be exactly `watchlist` and `deepdive` (lowercase, no space)

**Changes to the Sheet don't appear**
- 5-minute edge cache. Wait a bit or hard-reload.
- If still nothing after 10 minutes, check Vercel Functions logs for the `/api/content` call

**Deep dive shows fallback values**
- The `deepdive` tab needs at least the `title` column filled in
- Headers in row 1 must exactly be: `issue, date, title, summary, discordUrl`

---

## Stage 5 (next)

- Custom domain
- Social share card perfection (the 1200x630 image that previews on Twitter/iMessage)
- SEO polish (meta description, sitemap, robots.txt)
- Final QA before sharing publicly

---

Not financial advice. For entertainment only. Stay frosty.
