// ============================================================
// /api/content.js — Fetches watchlist + deep dive from Google Sheets
// ============================================================
// Your Google Sheet should have two tabs (sheet names matter):
//   • "watchlist"  - columns: symbol, name, thesis
//   • "deepdive"   - single row: issue, date, title, summary, discordUrl
//
// How to set it up:
//   1. Create a new Google Sheet
//   2. Name the first tab "watchlist", add columns + rows
//   3. Add a second tab "deepdive", one row of content
//   4. File → Share → Anyone with the link (Viewer)
//   5. File → Share → Publish to web → Entire document → CSV
//   6. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
//   7. Set SHEET_ID in Vercel env vars: GOOGLE_SHEET_ID=xxxxx
//
// You edit the sheet from your phone, site picks it up within 5 minutes.
// If the fetch fails, the UI falls back to data.js values gracefully.
// ============================================================

const SHEET_ID = process.env.GOOGLE_SHEET_ID

// Google Sheets CSV export URL format
function sheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
}

// Minimal CSV parser (handles quoted fields with commas inside)
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

// Turn CSV rows into list of objects using first row as keys
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
      error: 'GOOGLE_SHEET_ID not set. Add it in Vercel → Settings → Environment Variables.',
    })
  }

  try {
    // Fetch both tabs in parallel
    const [watchlistRows, deepdiveRows] = await Promise.all([
      fetchSheet('watchlist'),
      fetchSheet('deepdive'),
    ])

    const watchlist = watchlistRows.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      thesis: r.thesis,
    }))

    const first = deepdiveRows[0] || {}
    const deepDive = {
      issue: parseInt(first.issue || '0', 10) || 0,
      date: first.date || '',
      title: first.title || '',
      summary: first.summary || '',
      discordUrl: first.discordurl || first.discord_url || '#',
    }

    // Cache at the edge for 5 minutes
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
