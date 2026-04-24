// ============================================================
// /api/sparklines.js -- Serverless function on Vercel
// ============================================================
// Returns 7-day closing prices for each ticker, used to draw
// sparklines in the scoreboard cards.
//
// Fetches Finnhub's /stock/candle endpoint (daily resolution).
// Edge-cached for 10 minutes -- sparklines show daily trend, so
// they don't need the 30-second refresh that current prices get.
// ============================================================

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const DAYS = 7

const TICKER_MAP = {
  SPY:   { finnhub: 'SPY',             type: 'stock' },
  QQQ:   { finnhub: 'QQQ',             type: 'stock' },
  USO:   { finnhub: 'USO',             type: 'stock' },
  GLD:   { finnhub: 'GLD',             type: 'stock' },
  SLV:   { finnhub: 'SLV',             type: 'stock' },
  GDX:   { finnhub: 'GDX',             type: 'stock' },
  XLE:   { finnhub: 'XLE',             type: 'stock' },
  BTC:   { finnhub: 'BINANCE:BTCUSDT', type: 'crypto' },
  ETH:   { finnhub: 'BINANCE:ETHUSDT', type: 'crypto' },
  SOL:   { finnhub: 'BINANCE:SOLUSDT', type: 'crypto' },
  VIXY:  { finnhub: 'VIXY',            type: 'stock' },
  UUP:   { finnhub: 'UUP',             type: 'stock' },
}

async function fetchCandles(symbol, type, apiKey) {
  try {
    const now = Math.floor(Date.now() / 1000)
    const from = now - DAYS * 24 * 60 * 60
    const endpoint = type === 'crypto' ? 'crypto/candle' : 'stock/candle'
    const url = `${FINNHUB_BASE}/${endpoint}?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${apiKey}`

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return { values: null, error: `HTTP ${res.status}` }

    const data = await res.json()
    if (data.s !== 'ok' || !Array.isArray(data.c) || data.c.length === 0) {
      return { values: null, error: data.s || 'no data' }
    }

    return { values: data.c }
  } catch (err) {
    return { values: null, error: err.message || 'fetch failed' }
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'FINNHUB_API_KEY not set' })
  }

  const symbols = Object.keys(TICKER_MAP)
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const { finnhub, type } = TICKER_MAP[symbol]
      const sparkline = await fetchCandles(finnhub, type, apiKey)
      return [symbol, sparkline]
    })
  )

  const sparklines = Object.fromEntries(results)

  // Longer cache -- sparklines show daily trend, don't need live updates
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
  res.status(200).json({
    sparklines,
    fetchedAt: new Date().toISOString(),
  })
}
