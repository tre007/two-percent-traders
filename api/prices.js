// ============================================================
// /api/prices.js -- Serverless function on Vercel
// ============================================================
// Calls Finnhub for live prices. Browser polls every 30s.
//
// To add a new ticker:
//   1. Add it to TICKER_MAP below with the correct Finnhub symbol
//   2. Make sure it's also in src/data.js (scoreboard or watchlist)
// ============================================================

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

async function fetchQuote(symbol, type, apiKey) {
  try {
    const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (!res.ok) {
      return { price: null, change: null, error: `HTTP ${res.status}` }
    }

    const data = await res.json()
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

const TICKER_MAP = {
  // Scoreboard - all 16 tickers across 6 categories

  // Markets
  'SPY':   { finnhub: 'SPY',             type: 'stock'  },
  'QQQ':   { finnhub: 'QQQ',             type: 'stock'  },

  // Energy
  'XLE':   { finnhub: 'XLE',             type: 'stock'  },
  'USO':   { finnhub: 'USO',             type: 'stock'  },

  // Metals
  'GLD':   { finnhub: 'GLD',             type: 'stock'  },
  'SLV':   { finnhub: 'SLV',             type: 'stock'  },
  'GDX':   { finnhub: 'GDX',             type: 'stock'  },

  // Crypto
  'BTC':   { finnhub: 'BINANCE:BTCUSDT', type: 'crypto' },
  'ETH':   { finnhub: 'BINANCE:ETHUSDT', type: 'crypto' },
  'SOL':   { finnhub: 'BINANCE:SOLUSDT', type: 'crypto' },

  // Commodities
  'PDBC':  { finnhub: 'PDBC',            type: 'stock'  },
  'URA':   { finnhub: 'URA',             type: 'stock'  },
  'COPX':  { finnhub: 'COPX',            type: 'stock'  },

  // Equities
  'VXUS':  { finnhub: 'VXUS',            type: 'stock'  },
  'IRM':   { finnhub: 'IRM',             type: 'stock'  },
  'META':  { finnhub: 'META',            type: 'stock'  },

  // Watchlist-only tickers (not on the scoreboard but used in watchlist)
  'WPM':   { finnhub: 'WPM',   type: 'stock' },
  'VUG':   { finnhub: 'VUG',   type: 'stock' },

  // GOLD/SILVER labels in watchlist - map to GLD/SLV ETF as fallback
  'GOLD':   { finnhub: 'GLD',   type: 'stock' },
  'SILVER': { finnhub: 'SLV',   type: 'stock' },
}

export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      error: 'FINNHUB_API_KEY not set. Add it in Vercel > Settings > Environment Variables.',
    })
  }

  const symbols = Object.keys(TICKER_MAP)
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const { finnhub, type } = TICKER_MAP[symbol]
      const quote = await fetchQuote(finnhub, type, apiKey)
      return [symbol, quote]
    })
  )

  const prices = Object.fromEntries(results)

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
  res.status(200).json({
    prices,
    fetchedAt: new Date().toISOString(),
  })
}
