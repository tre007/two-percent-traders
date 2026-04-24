// ============================================================
// 2% TRADERS - SITE CONTENT
// ============================================================
// This file is where you edit the site's content.
// You don't need to know how to code to edit this.
// Just change the text inside the quotes and save.
// Don't change anything OUTSIDE the quotes.
//
// Scroll down and you'll see:
//   1. SCOREBOARD  - the 12 tickers at the top of the page
//   2. WATCHLIST   - the 15 tickers with your thesis
//   3. DEEP DIVE   - the featured weekly post
//   4. DISCORD URL - your server invite link
//
// When you change this file, the live site updates automatically
// (as long as you've deployed it to Vercel or similar).
// ============================================================


// ------------------------------------------------------------
// 1. THE SCOREBOARD
// ------------------------------------------------------------
// Prices come from the live API. The `price: null` values here
// are fallbacks - used only if Finnhub fails.
// ------------------------------------------------------------
export const scoreboard = [
  { symbol: 'SPY',   price: null, change: null },  // S&P 500 ETF
  { symbol: 'QQQ',   price: null, change: null },  // Nasdaq-100 ETF
  { symbol: 'USO',   price: null, change: null },  // Oil ETF
  { symbol: 'GLD',   price: null, change: null },  // Gold ETF
  { symbol: 'SLV',   price: null, change: null },  // Silver ETF
  { symbol: 'GDX',   price: null, change: null },  // Gold Miners ETF
  { symbol: 'XLE',   price: null, change: null },  // Energy ETF
  { symbol: 'BTC',   price: null, change: null },  // Bitcoin
  { symbol: 'ETH',   price: null, change: null },  // Ethereum
  { symbol: 'SOL',   price: null, change: null },  // Solana
  { symbol: 'VIXY',  price: null, change: null },  // Volatility ETF
  { symbol: 'UUP',   price: null, change: null },  // Dollar Bullish ETF
]


// ------------------------------------------------------------
// 2. THE WATCHLIST
// ------------------------------------------------------------
// 15 tickers with your thesis. Edit the `thesis` field to update.
// Keep each thesis to 1-2 sentences for visual consistency.
// ------------------------------------------------------------
export const watchlist = [
  {
    symbol: 'XLE',
    name: 'Energy Sector ETF',
    price: 62.18,
    change: -0.87,
    thesis: 'Direct beneficiary of $100+ oil. Energy producers win regardless of what currency oil is priced in.',
  },
  {
    symbol: 'GDX',
    name: 'Gold Miners ETF',
    price: 86.42,
    change: 2.31,
    thesis: 'Moves 2-3x the gold price. Leveraged exposure to the dollar collapse thesis.',
  },
  {
    symbol: 'WPM',
    name: 'Wheaton Precious Metals',
    price: 124.50,
    change: 1.88,
    thesis: 'Royalty and streaming model. Gold exposure without mining operational risk.',
  },
  {
    symbol: 'GOLD',
    name: 'Physical Gold Spot',
    price: 4663.50,
    change: 1.18,
    thesis: 'Central banks targeting $6,000+. Still early. Still accumulating.',
  },
  {
    symbol: 'SILVER',
    name: 'Physical Silver Spot',
    price: 52.78,
    change: 2.04,
    thesis: 'Higher percentage upside than gold in a real collapse. Physical stacking entry.',
  },
  {
    symbol: 'VXUS',
    name: 'Total International ETF',
    price: 75.20,
    change: 0.34,
    thesis: 'Gains automatically when the dollar weakens. Profit from local growth and currency appreciation.',
  },
  {
    symbol: 'PDBC',
    name: 'Commodities Basket',
    price: 20.14,
    change: 0.89,
    thesis: 'Oil, metals, agriculture in one fund. Every hard asset reprices up when the dollar weakens.',
  },
  {
    symbol: 'URA',
    name: 'Uranium ETF',
    price: 47.32,
    change: 3.12,
    thesis: 'AI data centers need baseload power. Nuclear renaissance is happening in real time.',
  },
  {
    symbol: 'COPX',
    name: 'Copper Miners ETF',
    price: 72.40,
    change: 1.67,
    thesis: 'Electrification supercycle. EVs, AI data centers, grid modernization all need copper.',
  },
  {
    symbol: 'IRM',
    name: 'Iron Mountain REIT',
    price: 104.22,
    change: 0.78,
    thesis: 'AI infrastructure data center REIT. Pays dividends while the thesis plays out.',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 105234,
    change: -1.54,
    thesis: 'Down 48% from ATH. Institutions accumulating. DCA only, never lump sum.',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3547,
    change: -2.11,
    thesis: 'Layer 2 activity growing. Settlement layer for the next internet.',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    price: 184.50,
    change: -3.04,
    thesis: '10 billion transactions in Q1 2026. Fastest chain with real usage.',
  },
  {
    symbol: 'VUG',
    name: 'Vanguard Growth ETF',
    price: 423.14,
    change: 0.56,
    thesis: 'Core growth engine. Large-cap US growth. Tax-free compounding for decades.',
  },
  {
    symbol: 'META',
    name: 'Meta Platforms',
    price: 534.22,
    change: -0.92,
    thesis: 'AI monetization play. Fundamentals solid. Down 33% from ATH presents an entry.',
  },
]


// ------------------------------------------------------------
// 3. THE DEEP DIVE
// ------------------------------------------------------------
// Featured weekly post. Update each Wednesday after posting.
// `discordUrl` is where "Read full post on Discord" links to.
// ------------------------------------------------------------
export const deepDive = {
  issue: 14,
  date: 'APRIL 23, 2026',
  title: 'Gold miners or physical gold?',
  summary: 'GDX gives you 2-3x leverage to the gold price with zero storage hassle. Physical gold gives you zero counterparty risk and lives outside the financial system. The real answer is not one or the other. Here is how I am sizing each.',
  discordUrl: 'https://discord.gg/zEAqUXA2wJ',
}


// ------------------------------------------------------------
// 4. DISCORD INVITE URL
// ------------------------------------------------------------
// The "Join the Discord" button in the footer links here.
// ------------------------------------------------------------
export const discordInviteUrl = 'https://discord.gg/zEAqUXA2wJ'
