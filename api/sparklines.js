// ============================================================
// /api/sparklines.js -- Serverless function on Vercel
// ============================================================
// Uses Twelve Data's time_series endpoint to fetch 7 days of
// daily closing prices for each ticker, used to draw sparklines.
//
// Rate limit note: Twelve Data free tier = 8 calls/minute.
// We have 12 tickers. Strategy: fetch 4 at a time, wait 8 sec,
// fetch the next 4, wait 8 sec, fetch final 4. That's 12 calls
// spread across ~16 seconds = well under 8/min.
//
// Edge-cached for 10 minutes since daily bars don't change
// meaningfully intraday. This means the function itself only
// runs a few times per hour regardless of how much traffic
// the site gets.
// ============================================================

const TD_BASE = 'https://api.twelvedata.com'
const DAYS = 7

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

    if (data.status === 'error') {
      return { values: null, error: data.message || 'API error' }
    }

    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      return { values: null, error: 'no data' }
    }

    // Twelve Data returns newest-first, flip for left-to-right drawing
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
  const BATCH_SIZE = 4
  const GAP_MS = 8000 // 8 seconds between batches
  const allResults = []

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        const { td } = TICKER_MAP[symbol]
        const series = await fetchSeries(td, apiKey)
        return [symbol, series]
      })
    )
    allResults.push(...batchResults)

    // Gap between batches, but not after the last one
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise((r) => setTimeout(r, GAP_MS))
    }
  }

  const sparklines = Object.fromEntries(allResults)

  // 10 min edge cache. This function runs at most ~6 times per hour.
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
  res.status(200).json({
    sparklines,
    fetchedAt: new Date().toISOString(),
  })
}
