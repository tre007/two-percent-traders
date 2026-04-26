// ============================================================
// 2% TRADERS - SITE CONTENT
// ============================================================
// This file is where you edit the site's content.
// You don't need to know how to code to edit this.
// Just change the text inside the quotes and save.
// Don't change anything OUTSIDE the quotes.
//
// Scroll down and you'll see:
//   1. SCOREBOARD  - 16 tickers organized into 6 categories
//   2. WATCHLIST   - fallback values, real data comes from sheet
//   3. DEEP DIVE   - fallback for the featured weekly post
//   4. DISCORD URL - your server invite link
// ============================================================


// ------------------------------------------------------------
// 1. THE SCOREBOARD
// ------------------------------------------------------------
// Tickers are organized into named categories. Each category
// renders as its own subsection on the page with a small label.
// Prices come from the live API. The `price: null` values here
// are fallbacks - used only if Finnhub fails.
//
// To add a ticker:
//   1. Add it to the right category below
//   2. Make sure it's also in api/prices.js TICKER_MAP
//   3. Optional: add to api/sparklines.js (max 8 sparklines!)
//
// To remove a ticker:
//   1. Delete its line from the right category below
//   2. Optional: remove from api/prices.js + api/sparklines.js
// ------------------------------------------------------------
export const scoreboardCategories = [
  {
    label: 'Markets',
    tickers: [
      { symbol: 'SPY',  price: null, change: null },
      { symbol: 'QQQ',  price: null, change: null },
    ],
  },
  {
    label: 'Energy',
    tickers: [
      { symbol: 'XLE',  price: null, change: null },
      { symbol: 'USO',  price: null, change: null },
    ],
  },
  {
    label: 'Metals',
    tickers: [
      { symbol: 'GLD',  price: null, change: null },
      { symbol: 'SLV',  price: null, change: null },
      { symbol: 'GDX',  price: null, change: null },
    ],
  },
  {
    label: 'Crypto',
    tickers: [
      { symbol: 'BTC',  price: null, change: null },
      { symbol: 'ETH',  price: null, change: null },
      { symbol: 'SOL',  price: null, change: null },
    ],
  },
  {
    label: 'Commodities',
    tickers: [
      { symbol: 'PDBC', price: null, change: null },
      { symbol: 'URA',  price: null, change: null },
      { symbol: 'COPX', price: null, change: null },
    ],
  },
  {
    label: 'Equities',
    tickers: [
      { symbol: 'VXUS', price: null, change: null },
      { symbol: 'IRM',  price: null, change: null },
      { symbol: 'META', price: null, change: null },
    ],
  },
]

// Flat list of all scoreboard tickers (used by the price merge logic)
export const scoreboard = scoreboardCategories.flatMap((c) => c.tickers)


// ------------------------------------------------------------
// 2. THE WATCHLIST (fallback values - real data from Sheet)
// ------------------------------------------------------------
export const watchlist = [
  {
    symbol: 'XLE',
    name: 'Energy Sector ETF',
    price: 62.18,
    change: -0.87,
    thesis: 'Direct beneficiary of $100+ oil. Energy producers win regardless of what currency oil is priced in.',
  },
]


// ------------------------------------------------------------
// 3. THE DEEP DIVE (fallback - real data from Sheet)
// ------------------------------------------------------------
export const deepDive = {
  issue: 14,
  date: 'APRIL 23, 2026',
  title: 'Gold miners or physical gold?',
  summary: 'GDX gives you 2-3x leverage to the gold price with zero storage hassle. Physical gold gives you zero counterparty risk and lives outside the financial system.',
  discordUrl: 'https://discord.gg/zEAqUXA2wJ',
}


// ------------------------------------------------------------
// 4. DISCORD INVITE URL
// ------------------------------------------------------------
export const discordInviteUrl = 'https://discord.gg/zEAqUXA2wJ'
