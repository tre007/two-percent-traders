// ============================================================
// /api/content.js -- Fetches watchlist + deep dive from Google Sheets
// ============================================================
// Uses Google's "Publish to web" CSV endpoint, which is more
// reliable than the gviz/tq endpoint (which has a known bug that
// sometimes collapses all rows into one row).
//
// Required env vars in Vercel:
//   GOOGLE_PUBLISH_ID    - the "2PACX-..." ID from a published URL
//   GOOGLE_WATCHLIST_GID - numeric tab ID for the watchlist tab
//   GOOGLE_DEEPDIVE_GID  - numeric tab ID for the deepdive tab
//
// To find these: File > Share > Publish to web > pick the tab >
// format CSV > look at the URL. The gid parameter is the tab ID.
//
// The 'price' column in the watchlist is optional. When filled in,
// the site uses that value instead of the live API for that row.
// Useful for tickers the live API doesn't support (spot gold, etc).
// ============================================================

const PUBLISH_ID = process.env.GOOGLE_PUBLISH_ID
const WATCHLIST_GID = process.env.GOOGLE_WATCHLIST_GID
const DEEPDIVE_GID = process.env.GOOGLE_DEEPDIVE_GID

function publishedCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${PUBLISH_ID}/pub?gid=${gid}&single=true&output=csv`
}

// RFC-ish CSV parser - handles quoted fields with commas and escaped quotes
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
  }).filter((obj) => Object.values(obj).some((v) => v && v.length > 0))
}

async function fetchPublishedCsv(gid) {
  const url = publishedCsvUrl(gid)
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`gid=${gid} returned ${res.status}`)
  const text = await res.text()
  return csvToObjects(parseCSV(text))
}

export default async function handler(req, res) {
  if (!PUBLISH_ID || !WATCHLIST_GID || !DEEPDIVE_GID) {
    return res.status(500).json({
      error: 'Missing env vars. Need GOOGLE_PUBLISH_ID, GOOGLE_WATCHLIST_GID, GOOGLE_DEEPDIVE_GID.',
    })
  }

  try {
    const [watchlistRows, deepdiveRows] = await Promise.all([
      fetchPublishedCsv(WATCHLIST_GID),
      fetchPublishedCsv(DEEPDIVE_GID),
    ])

    // Parse optional price column. Strip $, commas, whitespace.
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
