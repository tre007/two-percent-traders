// ============================================================
// /api/sparklines.js -- Serverless function on Vercel
// ============================================================
// Uses Twelve Data's time_series endpoint to fetch 7 days of
// daily closing prices for each ticker. Used to draw sparklines
// in the scoreboard cards.
//
// Why Twelve Data instead of Finnhub:
//   Finnhub moved /stock/candle to paid tier in 2025.
//   Twelve Data's free tier (800 calls/day) supports daily
//   bars for stocks, ETFs, and crypto on one endpoint.
//
// Edge-cached for 10 minutes since daily bars don't change
// intraday meaningfully.
// ============================================================

const TD_BASE = 'https://api.twelvedata.com'
const DAYS = 7

// Twelve Data uses different symbol formats than Finnhub.
// Stocks/ETFs: plain ticker (e.g. "SPY")
// Crypto: "BTC/USD" format (not Binance URLs)
const TICKER_MAP = {
  SPY:   { td: 'SPY'     },
  QQQ:   { td: 'QQQ'     },
  USO:   { td: 'USO'     },
  GLD:   { td: 'GLD'     },
  SLV:   { td: 'SLV'     },
  GDX:   { td: 'GDX'     },
  XLE:   { td: 'XLE'     },
  BTC:   { td: 'BTC/USD' },
  ETH:   { td: 'ETH/USD' },
  SOL:   { td: 'SOL/USD' },
  VIXY:  { td: 'VIXY'    },
  UUP:   { td: 'UUP'     },
}

async function fetchSeries(symbol, apiKey) {
  try {
    const url = `${TD_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${DAYS}&apikey=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })

    if (!res.ok) return { values: null, error: `HTTP ${res.status}` }

    const data = await res.json()

    // Twelve Data returns { status: "error", message: "..." } on problems
    if (data.status === 'error') {
      return { values: null, error: data.message || 'API error' }
    }

    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return { values: null, error: 'no data' }
    }

    // Twelve Data returns values newest-first. Reverse so sparkline draws
    // oldest-to-newest (left to right).
    const closes = data.values
      .map((row) => parseFloat(row.close))
      .filter((n) => !isNaN(n))
      .reverse()

    return { values: closes }
  } catch (err) {
    return { values: null, error: err.message || 'fetch failed' }
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'TWELVEDATA_API_KEY not set in Vercel env vars' })
  }

  const symbols = Object.keys(TICKER_MAP)

  // Twelve Data free tier allows 8 calls/min.
  // 12 parallel calls could briefly spike above that, so we fire them
  // as 2 sequential batches of 6 with a small gap. Edge cache of 10 min
  // means this rate is hit at most once per 10 minutes regardless of
  // how many visitors hit the site.
  const batchSize = 6
  const allResults = []
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        const { td } = TICKER_MAP[symbol]
        const series = await fetchSeries(td, apiKey)
        return [symbol, series]
      })
    )
    allResults.push(...batchResults)
    // Small gap between batches if there's another round coming
    if (i + batchSize < symbols.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  const sparklines = Object.fromEntries(allResults)

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
  res.status(200).json({
    sparklines,
    fetchedAt: new Date().toISOString(),
  })
}
