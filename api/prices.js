// ============================================================
// /api/prices.js — Serverless function on Vercel
// ============================================================
// This file runs on Vercel's servers, not in the browser.
// It's how we keep your FINNHUB_API_KEY secret.
//
// The browser calls /api/prices, this function:
//   1. Reads your API key from Vercel's environment variables
//   2. Calls Finnhub for every ticker in parallel
//   3. Returns clean price data to the browser
//   4. Caches the response for 30 seconds to save API calls
//
// You should NOT need to edit this file. If a ticker is wrong,
// change it in src/data.js — the "finnhubSymbol" field.
// ============================================================

// Finnhub endpoint: different shape for stocks vs crypto vs forex
const FINNHUB_BASE = 'https://finnhub.io/api/v1'

async function fetchQuote(symbol, type, apiKey) {
  try {
    let url
    if (type === 'stock') {
      // Stocks + ETFs: /quote endpoint returns {c: current, dp: percent change}
      url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    } else if (type === 'crypto') {
      // Crypto: we use /quote with symbols like BINANCE:BTCUSDT
      url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    } else if (type === 'forex') {
      // Forex/metals via OANDA symbols like OANDA:XAU_USD
      url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    } else {
      return { price: null, change: null, error: 'unknown type' }
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (!res.ok) {
      return { price: null, change: null, error: `HTTP ${res.status}` }
    }

    const data = await res.json()
    // Finnhub quote response: c=current, pc=previous close, dp=percent change
    if (data.c === 0 || data.c == null) {
      return { price: null, change: null, error: 'no data' }
    }
    return {
      price: data.c,
      change: data.dp ?? 0,
    }
  } catch (err) {
    return { price: null, change: null, error: err.message || 'fetch failed' }
  }
}

// The tickers we fetch. This list mirrors what's in src/data.js
// but maps each to the right Finnhub symbol + type.
const TICKER_MAP = {
  // Scoreboard
  'S&P 500':  { finnhub: 'SPY',            type: 'stock'  }, // SPY tracks S&P 500
  'DOW':      { finnhub: 'DIA',            type: 'stock'  }, // DIA tracks Dow
  'BRENT':    { finnhub: 'USO',            type: 'stock'  }, // USO = oil proxy
  'GOLD':     { finnhub: 'OANDA:XAU_USD',  type: 'forex'  }, // Spot gold via OANDA
  'SILVER':   { finnhub: 'OANDA:XAG_USD',  type: 'forex'  }, // Spot silver via OANDA
  'GDX':      { finnhub: 'GDX',            type: 'stock'  },
  'XLE':      { finnhub: 'XLE',            type: 'stock'  },
  'BTC':      { finnhub: 'BINANCE:BTCUSDT',type: 'crypto' },
  'ETH':      { finnhub: 'BINANCE:ETHUSDT',type: 'crypto' },
  'SOL':      { finnhub: 'BINANCE:SOLUSDT',type: 'crypto' },
  'VIX':      { finnhub: 'VIXY',           type: 'stock'  }, // VIXY tracks VIX
  'DXY':      { finnhub: 'UUP',            type: 'stock'  }, // UUP tracks DXY

  // Watchlist-only tickers (not in scoreboard)
  'WPM':      { finnhub: 'WPM',  type: 'stock' },
  'VXUS':     { finnhub: 'VXUS', type: 'stock' },
  'PDBC':     { finnhub: 'PDBC', type: 'stock' },
  'URA':      { finnhub: 'URA',  type: 'stock' },
  'COPX':     { finnhub: 'COPX', type: 'stock' },
  'IRM':      { finnhub: 'IRM',  type: 'stock' },
  'VUG':      { finnhub: 'VUG',  type: 'stock' },
  'META':     { finnhub: 'META', type: 'stock' },
}

export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      error: 'FINNHUB_API_KEY not set. Add it in Vercel → Settings → Environment Variables.',
    })
  }

  // Fetch all tickers in parallel
  const symbols = Object.keys(TICKER_MAP)
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const { finnhub, type } = TICKER_MAP[symbol]
      const quote = await fetchQuote(finnhub, type, apiKey)
      return [symbol, quote]
    })
  )

  // Shape into { "S&P 500": { price, change }, ... }
  const prices = Object.fromEntries(results)

  // Cache headers — Vercel edge cache serves this for 30s before hitting our function again
  // This keeps us well under Finnhub's 60/min limit even with lots of visitors
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
  res.status(200).json({
    prices,
    fetchedAt: new Date().toISOString(),
  })
}
