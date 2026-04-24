// ============================================================
// /api/sparklines.js -- Serverless function on Vercel
// ============================================================
// Fetches 7-day daily closing prices from Twelve Data for the
// 8 most important scoreboard tickers. Each symbol costs 1
// credit, and Twelve Data free tier caps at 8 credits/minute,
// so we fetch exactly 8 tickers in a single batched request.
//
// The 4 other scoreboard tickers (USO, SOL, VIXY, UUP) render
// without sparklines - card shows symbol and price only. If
// you want to swap which 8 get sparklines, just edit the list
// below.
//
// Edge-cached for 10 minutes since daily bars don't change
// meaningfully intraday.
// ============================================================

const TD_BASE = 'https://api.twelvedata.com'
const DAYS = 7

// Exactly 8 tickers (Twelve Data free tier credit/minute limit).
// Each symbol = 1 credit, sent as a single comma-separated request.
// Stocks/ETFs use plain tickers. Crypto uses BTC/USD format.
const TICKER_MAP = {
  SPY:  'SPY',
  QQQ:  'QQQ',
  GLD:  'GLD',
  SLV:  'SLV',
  GDX:  'GDX',
  XLE:  'XLE',
  BTC:  'BTC/USD',
  ETH:  'ETH/USD',
}

// Build the comma-separated symbol list for a single batched request
const SYMBOL_LIST = Object.values(TICKER_MAP).join(',')

// Parse Twelve Data batch response shape.
// When you request multiple symbols, the response is keyed by ticker:
//   { "SPY": { "values": [...] }, "QQQ": { "values": [...] } }
// When you request a single symbol, the response is flat:
//   { "values": [...] }
function extractBatchValues(data, tdSymbol) {
  // Try batch shape first (keyed by symbol)
  const entry = data[tdSymbol]
  if (entry && Array.isArray(entry.values)) {
    return parseValues(entry.values)
  }
  // Fallback to flat shape
  if (Array.isArray(data.values)) {
    return parseValues(data.values)
  }
  return null
}

function parseValues(rows) {
  const closes = rows
    .map((row) => parseFloat(row.close))
    .filter((n) => !isNaN(n))
    .reverse() // oldest first for left-to-right drawing
  return closes.length >= 2 ? closes : null
}

export default async function handler(req, res) {
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'TWELVEDATA_API_KEY not set in Vercel env vars' })
  }

  try {
    const url = `${TD_BASE}/time_series?symbol=${encodeURIComponent(SYMBOL_LIST)}&interval=1day&outputsize=${DAYS}&apikey=${apiKey}`
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })

    if (!response.ok) {
      return res.status(500).json({ error: `Twelve Data HTTP ${response.status}` })
    }

    const data = await response.json()

    // Whole-response error (API key issue, rate limit, etc)
    if (data.status === 'error') {
      return res.status(500).json({ error: data.message || 'API error' })
    }

    const sparklines = {}
    for (const [displayKey, tdSymbol] of Object.entries(TICKER_MAP)) {
      const values = extractBatchValues(data, tdSymbol)
      sparklines[displayKey] = values
        ? { values }
        : { values: null, error: 'no data for ' + tdSymbol }
    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
    res.status(200).json({
      sparklines,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'fetch failed' })
  }
}
