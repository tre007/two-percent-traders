import { useEffect, useState, useRef, useCallback } from 'react'
import { scoreboard as scoreboardStatic, watchlist as watchlistStatic, deepDive as deepDiveStatic, discordInviteUrl } from './data'
import { useLivePrices } from './useLivePrices'
import { useLiveContent } from './useLiveContent'
import { useSparklines } from './useSparklines'

// ============================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================
const ACHIEVEMENTS = [
  { id: 'first_press',     title: 'First Press',       icon: '\uD83E\uDD8D', desc: 'Pressed the gorilla button.' },
  { id: 'stay_frosty',     title: 'Stay Frosty',       icon: '\u2744',       desc: 'Summoned the snow.' },
  { id: 'deep_reader',     title: 'Deep Reader',       icon: '\uD83D\uDCD6', desc: 'Read a past deep dive.' },
  { id: 'night_owl',       title: 'Night Owl',         icon: '\uD83C\uDF19', desc: 'Visited between midnight and 5am CT.' },
  { id: 'weekend_trader',  title: 'Weekend Trader',    icon: '\uD83D\uDCC5', desc: 'Visited on a weekend.' },
  { id: 'the_lurker',      title: 'The Lurker',        icon: '\uD83D\uDC40', desc: 'Stayed for 5+ minutes.' },
  { id: 'bull_run',        title: 'Bull Run',          icon: '\uD83D\uDC02', desc: 'Visited with 50%+ of the board green.' },
  { id: 'day_one',         title: 'Day One',           icon: '\uD83D\uDD12', desc: 'Found the founding date.' },
  { id: 'completionist',   title: 'The Completionist', icon: '\uD83C\uDFC6', desc: 'Unlocked everything else.' },
]
const REGULAR_IDS = ACHIEVEMENTS.filter(a => a.id !== 'completionist').map(a => a.id)
const STORAGE_KEY = 'twopct_achievements_v1'

// ============================================================
// useAchievements -- single hook managing unlock state
// ============================================================
function useAchievements() {
  const [unlocked, setUnlocked] = useState({})  // id -> ISO date string
  const [toast, setToast] = useState(null)      // achievement to display
  const toastTimerRef = useRef(null)
  const queueRef = useRef([])                   // pending toasts

  // Load saved achievements on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') setUnlocked(parsed)
      }
    } catch (err) {
      // localStorage might be unavailable (private mode etc) - silently continue
    }
  }, [])

  // Save whenever unlocked changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked))
    } catch (err) {
      // ignore
    }
  }, [unlocked])

  // Process the toast queue: show next, set timer to dismiss
  const showNextToast = useCallback(() => {
    if (queueRef.current.length === 0) return
    const next = queueRef.current.shift()
    setToast(next)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      // Wait for fade-out animation, then check for next
      setTimeout(() => showNextToast(), 400)
    }, 4000)
  }, [])

  // Unlock an achievement (no-op if already unlocked)
  const unlock = useCallback((id) => {
    setUnlocked(prev => {
      if (prev[id]) return prev
      const ach = ACHIEVEMENTS.find(a => a.id === id)
      if (!ach) return prev

      const next = { ...prev, [id]: new Date().toISOString() }

      // Queue the toast for this unlock
      queueRef.current.push(ach)
      // If no toast currently showing, kick off the queue
      if (!toast) {
        // Defer to next tick so state updates can settle
        setTimeout(() => showNextToast(), 0)
      }

      // Check completionist - if all REGULAR_IDS are unlocked, queue it too
      const allDone = REGULAR_IDS.every(rid => next[rid])
      if (allDone && !next['completionist']) {
        next['completionist'] = new Date().toISOString()
        const compl = ACHIEVEMENTS.find(a => a.id === 'completionist')
        queueRef.current.push(compl)
      }

      return next
    })
  }, [toast, showNextToast])

  return { unlocked, toast, unlock }
}

// ============================================================
// HELPERS
// ============================================================
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

function getCTHour(d) {
  return parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit', hour12: false,
  }).format(d))
}

function getCTWeekday(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
  }).format(d)
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

// ============================================================
// COMPONENTS
// ============================================================
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

function Snowfall({ active }) {
  if (!active) return null

  const flakes = Array.from({ length: 120 }, (_, i) => {
    const left = Math.random() * 100
    const fontSize = 10 + Math.random() * 18
    const delay = Math.random() * 10
    const duration = 5 + Math.random() * 3
    const opacity = 0.5 + Math.random() * 0.5
    const drift = (Math.random() - 0.5) * 100
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
          {'\u2744'}
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

// Calculate days since founding date (Jan 7, 2021)
function getDaysSinceFounding() {
  const founding = new Date(2021, 0, 7) // Jan 7, 2021 - month is 0-indexed
  const today = new Date()
  const diffMs = today - founding
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function Header({ now, onSecretClick, dayOneUnlocked, onWordmarkTripleClick }) {
  const open = isMarketOpen(now)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef(null)

  function handleWordmarkClick() {
    clickCountRef.current += 1
    clearTimeout(clickTimerRef.current)
    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0
      onWordmarkTripleClick && onWordmarkTripleClick()
    } else {
      // Reset count if no third click within 800ms
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0
      }, 800)
    }
  }

  // Cleanup any pending click timer on unmount
  useEffect(() => () => clearTimeout(clickTimerRef.current), [])

  const tagline = dayOneUnlocked
    ? `DAY ${getDaysSinceFounding().toLocaleString()}`
    : 'FRIENDS SINCE 2021'

  return (
    <header className="border-b border-white/5 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-3">
            <img src="/logo-icon-header.svg" alt="2% Traders" className="w-16 h-16 md:w-20 md:h-20" />
            <div
              onClick={handleWordmarkClick}
              className="cursor-pointer select-none"
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif italic text-brand-amber text-2xl md:text-[1.65rem] leading-none">2%</span>
                <span className="font-sans font-bold text-neutral-100 tracking-[0.15em] text-sm md:text-base">TRADERS</span>
              </div>
              <p className={`font-mono text-[10px] tracking-[0.15em] mt-0.5 transition-colors ${dayOneUnlocked ? 'text-brand-amber/80' : 'text-neutral-500'}`}>
                {tagline}
              </p>
            </div>
          </div>

          <div className="font-mono flex items-center gap-3 text-xs md:text-sm text-neutral-300 flex-wrap">
            <span>{formatDate(now)}</span>
            <span className="text-neutral-700">|</span>
            <span>{formatTime(now)} CT</span>
            <span className="text-neutral-700">|</span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSecretClick}
                className={`text-base md:text-lg leading-none cursor-pointer hover:scale-125 transition-transform ${open ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'}`}
                aria-label="Stay frosty"
              >
                {'\u2744'}
              </button>
              <span className={open ? 'text-emerald-400' : 'text-neutral-400'}>
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

function ArchiveRow({ post, onExpand }) {
  const [expanded, setExpanded] = useState(false)

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next && onExpand) onExpand()
  }

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={toggle}
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

function ArchiveList({ archive, onExpand }) {
  if (!archive || archive.length === 0) return null

  return (
    <div className="border-t border-white/5">
      {archive.map((post) => (
        <ArchiveRow key={post.issue} post={post} onExpand={onExpand} />
      ))}
    </div>
  )
}

function SecretButton({ onPress }) {
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

  function handleClick() {
    setOpen(true)
    if (onPress) onPress()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-400 hover:text-rose-400 border border-neutral-700 hover:border-rose-400/50 px-4 py-2 mt-6 transition-colors cursor-pointer inline-flex items-center gap-2 secret-pulse"
        aria-label="Do not press"
      >
        <span className="text-rose-400/80" aria-hidden="true">!</span>
        Do not press this button
      </button>

      <style>{`
        @keyframes secret-pulse-anim {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251, 113, 133, 0); }
          50%      { box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.18); }
        }
        .secret-pulse {
          animation: secret-pulse-anim 2.5s ease-in-out infinite;
        }
        .secret-pulse:hover {
          animation: none;
        }
      `}</style>

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

// ============================================================
// ACHIEVEMENT TOAST: slide-in notification at bottom-right
// ============================================================
function AchievementToast({ achievement }) {
  if (!achievement) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-xs pointer-events-none"
      style={{ animation: 'toast-slide 4s ease-in-out forwards' }}
    >
      <div className="border border-brand-amber/60 bg-black/95 backdrop-blur-sm px-4 py-3 flex items-center gap-3 shadow-lg">
        <span className="text-2xl">{achievement.icon}</span>
        <div>
          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-brand-amber/80">
            Achievement Unlocked
          </div>
          <div className="font-sans text-sm text-neutral-100 font-semibold mt-0.5">
            {achievement.title}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes toast-slide {
          0%   { transform: translateY(20px); opacity: 0; }
          8%   { transform: translateY(0); opacity: 1; }
          92%  { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(20px); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ============================================================
// TROPHY MODAL: list of all achievements (locked + unlocked)
// ============================================================
function TrophyButton({ unlocked }) {
  const [open, setOpen] = useState(false)
  const unlockedCount = Object.keys(unlocked).length

  // All hooks must be called unconditionally before any early return
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

  // Hide button until 3+ achievements (early return AFTER hooks)
  if (unlockedCount < 3) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] tracking-[0.2em] uppercase text-brand-amber/70 hover:text-brand-amber border border-brand-amber/30 hover:border-brand-amber/70 px-4 py-2 mt-3 transition-colors cursor-pointer inline-flex items-center gap-2"
        aria-label="View achievements"
      >
        <span aria-hidden="true">{'\uD83C\uDFC6'}</span>
        Achievements ({unlockedCount}/{ACHIEVEMENTS.length})
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
            className="relative bg-black border border-brand-amber/30 max-w-lg w-full max-h-[85vh] overflow-y-auto"
          >
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase text-brand-amber/90">
                  Achievements // {unlockedCount}/{ACHIEVEMENTS.length}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-mono text-[10px] tracking-widest text-neutral-500 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  CLOSE
                </button>
              </div>

              <div className="space-y-3">
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = !!unlocked[ach.id]
                  return (
                    <div
                      key={ach.id}
                      className={`border ${isUnlocked ? 'border-brand-amber/30 bg-brand-amber/5' : 'border-white/5 bg-white/[0.015]'} p-3 flex items-center gap-3`}
                    >
                      <span className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-30'}`}>
                        {ach.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-sans font-semibold text-sm ${isUnlocked ? 'text-neutral-100' : 'text-neutral-600'}`}>
                          {isUnlocked ? ach.title : '???'}
                        </div>
                        <div className={`text-xs leading-snug mt-0.5 ${isUnlocked ? 'text-neutral-400' : 'text-neutral-700'}`}>
                          {isUnlocked ? ach.desc : 'Locked'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="font-mono text-[10px] text-neutral-600 tracking-wider mt-6 text-center">
                Stay frosty.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Footer({ unlocked, onPressGorilla }) {
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
            <SecretButton onPress={onPressGorilla} />
            <TrophyButton unlocked={unlocked} />
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

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [now, setNow] = useState(new Date())
  const { prices, loading, error, lastUpdated, isStale } = useLivePrices()
  const { watchlist: watchlistContent, deepDive, archive } = useLiveContent(watchlistStatic, deepDiveStatic)
  const { sparklines } = useSparklines()
  const [snowing, setSnowing] = useState(false)
  const snowTimerRef = useRef(null)
  const { unlocked, toast, unlock } = useAchievements()
  const visitStartRef = useRef(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => () => clearTimeout(snowTimerRef.current), [])

  // Time-of-day achievements - check on mount
  useEffect(() => {
    const d = new Date()
    const hour = getCTHour(d)
    const weekday = getCTWeekday(d)
    if (hour >= 0 && hour < 5) unlock('night_owl')
    if (weekday === 'Sat' || weekday === 'Sun') unlock('weekend_trader')
  }, [unlock])

  // Lurker achievement: 5+ minutes on the page
  useEffect(() => {
    const t = setTimeout(() => unlock('the_lurker'), 5 * 60 * 1000)
    return () => clearTimeout(t)
  }, [unlock])

  // Bull run achievement: check whenever prices update
  useEffect(() => {
    const tickers = scoreboardStatic.map((item) => prices[item.symbol]).filter(Boolean)
    if (tickers.length < 6) return // need at least half the board for meaningful signal
    const greenCount = tickers.filter((t) => t.change != null && t.change > 0).length
    if (greenCount / tickers.length >= 0.5) {
      unlock('bull_run')
    }
  }, [prices, unlock])

  function triggerSnow() {
    setSnowing(false)
    clearTimeout(snowTimerRef.current)
    requestAnimationFrame(() => {
      setSnowing(true)
      snowTimerRef.current = setTimeout(() => setSnowing(false), 18000)
    })
    unlock('stay_frosty')
  }

  function onGorillaPress() {
    unlock('first_press')
  }

  function onWordmarkTripleClick() {
    unlock('day_one')
  }

  function onArchiveExpand() {
    unlock('deep_reader')
  }

  const scoreboard = mergePrices(scoreboardStatic, prices)
  const watchlist = mergePrices(watchlistContent, prices)

  return (
    <div className="min-h-screen bg-black text-neutral-200">
      <Header
        now={now}
        onSecretClick={triggerSnow}
        dayOneUnlocked={!!unlocked['day_one']}
        onWordmarkTripleClick={onWordmarkTripleClick}
      />
      <Snowfall active={snowing} />
      <AchievementToast achievement={toast} />

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
            <ArchiveList archive={archive} onExpand={onArchiveExpand} />
          </section>
        )}
      </main>

      <Footer unlocked={unlocked} onPressGorilla={onGorillaPress} />
    </div>
  )
}
