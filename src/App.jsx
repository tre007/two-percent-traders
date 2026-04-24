import { useEffect, useState } from 'react'
import { scoreboard as scoreboardStatic, watchlist as watchlistStatic, deepDive as deepDiveStatic, discordInviteUrl } from './data'
import { useLivePrices } from './useLivePrices'
import { useLiveContent } from './useLiveContent'

// ============================================================
// HELPERS
// ============================================================
function formatPrice(price) {
  if (price == null) return '—'
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return price.toFixed(2)
}

function formatTime(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d)
}

function formatDate(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(d).toUpperCase()
}

function isMarketOpen(d) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const weekday = parts.find((p) => p.type === 'weekday').value
  const hour = parseInt(parts.find((p) => p.type === 'hour').value)
  const minute = parseInt(parts.find((p) => p.type === 'minute').value)
  if (weekday === 'Sat' || weekday === 'Sun') return false
  const minutes = hour * 60 + minute
  return minutes >= 510 && minutes < 900 // 8:30 AM - 3:00 PM CT
}

function mergePrices(staticList, livePrices) {
  return staticList.map((item) => {
    const live = livePrices[item.symbol]
    if (live && live.price != null) {
      return { ...item, price: live.price, change: live.change, isLive: true }
    }
    return { ...item, isLive: false }
  })
}

// ============================================================
// COMPONENTS
// ============================================================
function Change({ change }) {
  if (change == null) return <span className="text-xs font-mono text-neutral-600">—</span>
  const positive = change >= 0
  return (
    <span className={`text-xs font-mono font-medium ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {positive ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-px bg-brand-amber/60 w-6"></div>
      <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-brand-amber/90">
        {children}
      </span>
      <div className="h-px bg-white/5 flex-1"></div>
    </div>
  )
}

function ScoreboardCard({ item }) {
  return (
    <div className="group border border-white/5 hover:border-brand-amber/40 transition-all duration-200 bg-black/30 hover:bg-black/50 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-neutral-500">
          {item.symbol}
        </span>
        <Change change={item.change} />
      </div>
      <div className="font-mono text-xl md:text-2xl text-neutral-100 font-medium">
        {formatPrice(item.price)}
      </div>
    </div>
  )
}

function WatchlistCard({ item }) {
  return (
    <article className="py-5 md:py-6 border-b border-white/5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="font-mono font-semibold text-[0.95rem] tracking-[0.08em] text-brand-amber/90 shrink-0">
            {item.symbol}
          </h3>
          <span className="text-xs text-neutral-500 truncate hidden sm:inline">{item.name}</span>
        </div>
        <div className="flex items-baseline gap-3 shrink-0">
          <span className="font-mono text-base text-neutral-100">
            {formatPrice(item.price)}
          </span>
          <Change change={item.change} />
        </div>
      </div>
      <span className="text-[11px] text-neutral-500 sm:hidden block mb-2">{item.name}</span>
      <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">
        {item.thesis}
      </p>
    </article>
  )
}

function Header({ now }) {
  const open = isMarketOpen(now)
  return (
    <header className="border-b border-white/5 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="2% Traders" className="w-10 h-10 md:w-12 md:h-12" />
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif italic text-brand-amber text-2xl md:text-[1.65rem] leading-none">2%</span>
                <span className="font-sans font-bold text-neutral-100 tracking-[0.15em] text-sm md:text-base">TRADERS</span>
              </div>
              <p className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] mt-0.5">
                FRIENDS SINCE 2021
              </p>
            </div>
          </div>

          <div className="font-mono flex items-center gap-2.5 text-[10px] md:text-[11px] text-neutral-400 flex-wrap">
            <span>{formatDate(now)}</span>
            <span className="text-neutral-700">|</span>
            <span>{formatTime(now)} CT</span>
            <span className="text-neutral-700">|</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`}></span>
              <span className={open ? 'text-emerald-400' : 'text-neutral-500'}>
                {open ? 'MKT OPEN' : 'MKT CLOSED'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

function LiveStatus({ loading, error, lastUpdated, isStale }) {
  let text, color
  if (loading && !lastUpdated) {
    text = 'CONNECTING...'
    color = 'text-neutral-500'
  } else if (error) {
    text = 'API ERROR // SHOWING FALLBACK VALUES FROM data.js'
    color = 'text-rose-400'
  } else if (isStale) {
    text = `LAST UPDATE ${formatTime(lastUpdated)} CT // CONNECTION STALE`
    color = 'text-amber-400'
  } else if (lastUpdated) {
    text = `LIVE // UPDATED ${formatTime(lastUpdated)} CT // AUTO-REFRESH 30S`
    color = 'text-neutral-500'
  } else {
    text = 'LOADING'
    color = 'text-neutral-600'
  }

  return <p className={`font-mono text-[10px] mt-4 tracking-wider ${color}`}>{text}</p>
}

function DeepDive({ deepDive }) {
  return (
    <article
      className="border border-white/5 p-6 md:p-12 relative overflow-hidden"
      style={{ backgroundImage: 'radial-gradient(ellipse at top left, rgba(217, 119, 6, 0.08), transparent 60%)' }}
    >
      <div className="font-mono flex items-baseline justify-between mb-6 text-[10px] md:text-[11px] tracking-[0.22em] uppercase text-brand-amber/90 flex-wrap gap-2">
        <span>WEDNESDAY DEEP DIVE // ISSUE {String(deepDive.issue).padStart(3, '0')}</span>
        <span className="text-neutral-600">{deepDive.date}</span>
      </div>
      <h2 className="font-serif italic text-neutral-100 mb-6 leading-[1.1] text-3xl md:text-5xl">
        {deepDive.title}
      </h2>
      <p className="text-neutral-300 leading-relaxed max-w-2xl mb-8 text-base">
        {deepDive.summary}
      </p>
      
        href={deepDive.discordUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono inline-flex items-center gap-2 text-brand-amber hover:text-brand-amber/80 text-xs md:text-sm tracking-[0.2em] uppercase transition-colors group"
      >
        Read full post on Discord
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </a>
    </article>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-16 md:mt-20">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-md">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-serif italic text-brand-amber text-2xl">2%</span>
              <span className="font-sans font-bold text-neutral-100 tracking-[0.15em]">TRADERS</span>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              A small Discord community of friends tracking macro, metals, crypto, and everything in between. Not advice. Just us sharing what we're watching.
            </p>
          </div>
          <div className="flex flex-col gap-3 items-start md:items-end">
            
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono inline-flex items-center gap-2 px-5 py-2.5 border border-brand-amber/60 text-brand-amber hover:bg-brand-amber/10 hover:border-brand-amber transition-all text-xs md:text-sm tracking-[0.15em] uppercase"
            >
              Join the Discord →
            </a>
            <p className="font-mono text-[10px] text-neutral-600 tracking-[0.15em] uppercase max-w-xs text-left md:text-right">
              Not financial advice. For entertainment only. Stay frosty.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [now, setNow] = useState(new Date())
  const { prices, loading, error, lastUpdated, isStale } = useLivePrices()
  const { watchlist: watchlistContent, deepDive } = useLiveContent(watchlistStatic, deepDiveStatic)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const scoreboard = mergePrices(scoreboardStatic, prices)
  const watchlist = mergePrices(watchlistContent, prices)

  return (
    <div className="min-h-screen bg-black text-neutral-200">
      <Header now={now} />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
        {/* The Scoreboard */}
        <section className="mb-14 md:mb-20">
          <SectionLabel>The Scoreboard // Live</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            {scoreboard.map((item) => (
              <ScoreboardCard key={item.symbol} item={item} />
            ))}
          </div>
          <LiveStatus loading={loading} error={error} lastUpdated={lastUpdated} isStale={isStale} />
        </section>

        {/* The Watchlist */}
        <section className="mb-14 md:mb-20">
          <SectionLabel>The Watchlist // What We're Tracking</SectionLabel>
          <div className="border-t border-white/5">
            {watchlist.map((item) => (
              <WatchlistCard key={item.symbol} item={item} />
            ))}
          </div>
        </section>

        {/* Deep Dive */}
        <section>
          <SectionLabel>This Week</SectionLabel>
          <DeepDive deepDive={deepDive} />
        </section>
      </main>

      <Footer />
    </div>
  )
}
