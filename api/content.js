// ============================================================
// /api/content.js -- Fetches watchlist + deep dive from Google Sheets
// ============================================================
// Sheet structure:
//   Tab "watchlist": columns = symbol, name, thesis, price (optional)
//   Tab "deepdive":  columns = issue, date, title, summary, discordUrl
//
// The 'price' column is optional. When filled in, the site uses that
// value and skips the live API for that row. When blank, the live API
// provides the price automatically.
//
// Use cases:
//   - Custom rows (e.g. "Test", "My portfolio value")
//   - Tickers the live API doesn't support (spot gold, physical silver)
//   - Entry/target price reference points
// ============================================================

const SHEET_ID = process.env.GOOGLE_SHEET_ID

function sheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\n' || c === '\r') {
        if (field.length > 0 || row.length > 0) {
          row.push(field)
          rows.push(row)
          row = []
          field = ''
        }
        if (c === '\r' && next === '\n') i++
      } else {
        field += c
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function csvToObjects(rows) {
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const obj = {}
    headers.forEach((key, i) => {
      obj[key] = (row[i] || '').trim()
    })
    return obj
  }).filter((obj) => Object.values(obj).some((v) => v.length > 0))
}

async function fetchSheet(sheetName) {
  const res = await fetch(sheetUrl(sheetName), { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Sheet "${sheetName}" returned ${res.status}`)
  const text = await res.text()
  return csvToObjects(parseCSV(text))
}

export default async function handler(req, res) {
  if (!SHEET_ID) {
    return res.status(500).json({
      error: 'GOOGLE_SHEET_ID not set. Add it in Vercel env vars.',
    })
  }

  try {
    const [watchlistRows, deepdiveRows] = await Promise.all([
      fetchSheet('watchlist'),
      fetchSheet('deepdive'),
    ])

    // Parse optional price column. Strips dollar signs and commas
    // so people can type "$4,726" or "4726" or "4,726.50" and it works.
    const watchlist = watchlistRows.map((r) => {
      const priceStr = (r.price || '').replace(/[$,\s]/g, '')
      const priceNum = priceStr.length > 0 ? parseFloat(priceStr) : null
      return {
        symbol: r.symbol,
        name: r.name,
        thesis: r.thesis,
        manualPrice: (priceNum != null && !isNaN(priceNum)) ? priceNum : null,
      }
    })

    const first = deepdiveRows[0] || {}
    const deepDive = {
      issue: parseInt(first.issue || '0', 10) || 0,
      date: first.date || '',
      title: first.title || '',
      summary: first.summary || '',
      discordUrl: first.discordurl || first.discord_url || '#',
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({
      watchlist,
      deepDive,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch sheet' })
  }
}
