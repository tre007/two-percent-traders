// ============================================================
// /api/content.js -- Fetches watchlist + deep dive + archive from Google Sheets
// ============================================================
// Uses Google's "Publish to web" CSV endpoint.
//
// Sheet structure:
//   Tab "watchlist": symbol, name, thesis, price (optional)
//   Tab "deepdive":  issue, date, title, summary, discordUrl
//                    - Row 2 (first data row) = current featured post
//                    - Rows 3+                = archive of past posts
//
// Workflow for weekly update:
//   1. Right-click row 2, "Insert 1 row above"
//   2. Type this week's Deep Dive in the fresh row 2
//   3. Done. The old post automatically becomes archive.
// ============================================================

const PUBLISH_ID = process.env.GOOGLE_PUBLISH_ID
const WATCHLIST_GID = process.env.GOOGLE_WATCHLIST_GID
const DEEPDIVE_GID = process.env.GOOGLE_DEEPDIVE_GID

function publishedCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${PUBLISH_ID}/pub?gid=${gid}&single=true&output=csv`
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
  }).filter((obj) => Object.values(obj).some((v) => v && v.length > 0))
}

async function fetchPublishedCsv(gid) {
  const url = publishedCsvUrl(gid)
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`gid=${gid} returned ${res.status}`)
  const text = await res.text()
  return csvToObjects(parseCSV(text))
}

function normalizeDeepDive(row) {
  return {
    issue: parseInt(row.issue || '0', 10) || 0,
    date: row.date || '',
    title: row.title || '',
    summary: row.summary || '',
    discordUrl: row.discordurl || row.discord_url || '#',
  }
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

    // Watchlist
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

    // Deep dive: first row = featured, rest = archive
    const allDeepDives = deepdiveRows.map(normalizeDeepDive)
    const deepDive = allDeepDives[0] || { issue: 0, date: '', title: '', summary: '', discordUrl: '#' }
    const archive = allDeepDives.slice(1) // everything after the featured one

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({
      watchlist,
      deepDive,
      archive,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch sheet' })
  }
}
