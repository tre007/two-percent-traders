import { useEffect, useState, useRef } from 'react'
import { scoreboard as scoreboardStatic, watchlist as watchlistStatic, deepDive as deepDiveStatic, discordInviteUrl } from './data'
import { useLivePrices } from './useLivePrices'
import { useLiveContent } from './useLiveContent'
import { useSparklines } from './useSparklines'

function formatPrice(price) {
  if (price == null) return '--'
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
  return minutes >= 510 && minutes < 900
}

function mergePrices(staticList, livePrices) {
  return staticList.map((item) => {
    if (item.manualPrice != null) {
      return { ...item, price: item.manualPrice, change: null, isManual: true }
    }
    const live = livePrices[item.symbol]
    if (live && live.price != null) {
      return { ...item, price: live.price, change: live.change, isLive: true }
    }
    return { ...item, isLive: false }
  })
}

function Sparkline({ values, width = 100, height = 26 }) {
  if (!values || !Array.isArray(values) || values.length < 2) {
    return <div style={{ width, height }} />
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const positive = values[values.length - 1] >= values[0]
  const stroke = positive ? '#34d399' : '#fb7185'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity="0.85"
      />
    </svg>
  )
}

function Change({ change, isManual }) {
  if (isManual) {
    return <span className="text-[9px] font-mono tracking-[0.15em] text-neutral-500 uppercase">Manual</span>
  }
  if (change == null) return <span className="text-xs font-mono text-neutral-600">--</span>
  const positive = change >= 0
  const arrow = positive ? '\u25B2' : '\u25BC'
  return (
    <span className={`text-xs font-mono font-medium ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {arrow} {Math.abs(change).toFixed(2)}%
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

function ScoreboardCard({ item, sparkline }) {
  return (
    <div
      className="group border border-brand-amber/15 hover:border-brand-amber/50 transition-all duration-200 p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(212, 162, 86, 0.06) 0%, rgba(212, 162, 86, 0.02) 100%)',
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-neutral-400">
          {item.symbol}
        </span>
        <Change change={item.change} isManual={item.isManual} />
      </div>
      <div className="font-mono text-xl md:text-2xl text-neutral-100 font-medium mb-2">
        {formatPrice(item.price)}
      </div>
      <Sparkline values={sparkline} width={120} height={24} />
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
          <Change change={item.change} isManual={item.isManual} />
        </div>
      </div>
      <span className="text-[11px] text-neutral-500 sm:hidden block mb-2">{item.name}</span>
      <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">
        {item.thesis}
      </p>
    </article>
  )
}

// ============================================================
// SNOWFALL EASTER EGG
// Triggered by clicking the market status dot in the header.
// 50 snowflakes drift down at varying speeds for ~5 seconds,
// then fade out. Pure CSS animation, no library.
// ============================================================
function Snowfall({ active }) {
  if (!active) return null

  // Pre-generate 50 flakes with random properties
  const flakes = Array.from({ length: 120 }, (_, i) => {
    const left = Math.random() * 100             // viewport %
    const fontSize = 10 + Math.random() * 18     // px
    const delay = Math.random() * 1.5            // sec
    const duration = 4 + Math.random() * 3       // sec
    const opacity = 0.5 + Math.random() * 0.5
    const drift = (Math.random() - 0.5) * 100    // horizontal drift in px
    return { id: i, left, fontSize, delay, duration, opacity, drift }
  })

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
      aria-hidden="true"
    >
      {flakes.map((f) => (
        <span
          key={f.id}
          className="absolute select-none"
          style={{
            left: `${f.left}%`,
            top: '-30px',
            fontSize: `${f.fontSize}px`,
            opacity: f.opacity,
            color: '#cfe7f5',
            textShadow: '0 0 6px rgba(207, 231, 245, 0.6)',
            animation: `frosty-fall ${f.duration}s ${f.delay}s linear forwards`,
            ['--drift']: `${f.drift}px`,
          }}
        >
          *
        </span>
      ))}

      <style>{`
        @keyframes frosty-fall {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
          100% { transform: translate3d(var(--drift), 105vh, 0) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function Header({ now, onSecretClick }) {
  const open = isMarketOpen(now)
  return (
    <header className="border-b border-white/5 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-3">
            <img src="/logo-icon-header.svg" alt="2% Traders" className="w-16 h-16 md:w-20 md:h-20" />
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
              <button
                type="button"
                onClick={onSecretClick}
                className={`w-1.5 h-1.5 rounded-full cursor-pointer hover:scale-150 transition-transform ${open ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`}
                aria-label="Stay frosty"
              />
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
    text = 'LAST UPDATE ' + formatTime(lastUpdated) + ' CT // CONNECTION STALE'
    color = 'text-amber-400'
  } else if (lastUpdated) {
    text = 'LIVE // UPDATED ' + formatTime(lastUpdated) + ' CT // AUTO-REFRESH 30S // 7D TREND'
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
      <a
        href={deepDive.discordUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono inline-flex items-center gap-2 text-brand-amber hover:text-brand-amber/80 text-xs md:text-sm tracking-[0.2em] uppercase transition-colors group"
      >
        Read full post on Discord
        <span className="transition-transform group-hover:translate-x-1">&gt;</span>
      </a>
    </article>
  )
}

function ArchiveRow({ post }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left py-4 md:py-5 hover:bg-white/[0.015] transition-colors px-0"
      >
        <div className="flex items-baseline justify-between gap-4 flex-wrap md:flex-nowrap">
          <div className="flex items-baseline gap-3 min-w-0 flex-wrap md:flex-nowrap">
            <span className="font-mono text-[10px] tracking-[0.18em] text-brand-amber/70 shrink-0">
              ISSUE {String(post.issue).padStart(3, '0')}
            </span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-neutral-600 shrink-0 hidden sm:inline">
              {post.date}
            </span>
            <h3 className="font-serif italic text-neutral-200 text-base md:text-lg leading-snug">
              {post.title}
            </h3>
          </div>
          <span className={`font-mono text-[10px] text-neutral-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            &#9662;
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.1em] text-neutral-600 sm:hidden block mt-1">
          {post.date}
        </span>
      </button>

      {expanded && (
        <div className="pb-5 md:pb-6 pt-1">
          <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl mb-4">
            {post.summary}
          </p>
          <a
            href={post.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono inline-flex items-center gap-2 text-brand-amber hover:text-brand-amber/80 text-[11px] md:text-xs tracking-[0.2em] uppercase transition-colors group"
          >
            Read full post on Discord
            <span className="transition-transform group-hover:translate-x-1">&gt;</span>
          </a>
        </div>
      )}
    </div>
  )
}

function ArchiveList({ archive }) {
  if (!archive || archive.length === 0) return null

  return (
    <div className="border-t border-white/5">
      {archive.map((post) => (
        <ArchiveRow key={post.issue} post={post} />
      ))}
    </div>
  )
}

function SecretButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = original }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-700 hover:text-rose-400 transition-colors mt-6 cursor-pointer"
        aria-label="Do not press"
      >
        Do not press this button
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full"
          >
            <img
              src="/gorilla.jpg"
              alt=""
              className="w-full h-auto block"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 font-mono text-xs tracking-widest text-neutral-300 hover:text-white bg-black/60 hover:bg-black/80 px-3 py-1.5 transition-colors"
              aria-label="Close"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
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
            <SecretButton />
          </div>
          <div className="flex flex-col gap-3 items-start md:items-end">
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono inline-flex items-center gap-2 px-5 py-2.5 border border-brand-amber/60 text-brand-amber hover:bg-brand-amber/10 hover:border-brand-amber transition-all text-xs md:text-sm tracking-[0.15em] uppercase"
            >
              Join the Discord &gt;
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

export default function App() {
  const [now, setNow] = useState(new Date())
  const { prices, loading, error, lastUpdated, isStale } = useLivePrices()
  const { watchlist: watchlistContent, deepDive, archive } = useLiveContent(watchlistStatic, deepDiveStatic)
  const { sparklines } = useSparklines()
  const [snowing, setSnowing] = useState(false)
  const snowTimerRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Cleanup any pending snowfall timer on unmount
  useEffect(() => () => clearTimeout(snowTimerRef.current), [])

  function triggerSnow() {
    // Restart the animation each click - clear any old flakes first
    setSnowing(false)
    clearTimeout(snowTimerRef.current)
    requestAnimationFrame(() => {
      setSnowing(true)
      snowTimerRef.current = setTimeout(() => setSnowing(false), 7000)
    })
  }

  const scoreboard = mergePrices(scoreboardStatic, prices)
  const watchlist = mergePrices(watchlistContent, prices)

  return (
    <div className="min-h-screen bg-black text-neutral-200">
      <Header now={now} onSecretClick={triggerSnow} />
      <Snowfall active={snowing} />

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
        <section className="mb-14 md:mb-20">
          <SectionLabel>The Scoreboard // Live</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            {scoreboard.map((item) => (
              <ScoreboardCard
                key={item.symbol}
                item={item}
                sparkline={sparklines[item.symbol]?.values}
              />
            ))}
          </div>
          <LiveStatus loading={loading} error={error} lastUpdated={lastUpdated} isStale={isStale} />
        </section>

        <section className="mb-14 md:mb-20">
          <SectionLabel>The Watchlist // What We're Tracking</SectionLabel>
          <div className="border-t border-white/5">
            {watchlist.map((item) => (
              <WatchlistCard key={item.symbol} item={item} />
            ))}
          </div>
        </section>

        <section className="mb-14 md:mb-20">
          <SectionLabel>This Week</SectionLabel>
          <DeepDive deepDive={deepDive} />
        </section>

        {archive && archive.length > 0 && (
          <section>
            <SectionLabel>The Archive // Past Deep Dives</SectionLabel>
            <ArchiveList archive={archive} />
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
