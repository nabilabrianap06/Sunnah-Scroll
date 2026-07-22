import { useCallback, useEffect, useRef, useState } from 'react'
import { loadYouTubeApi } from '../lib/youtube'

// Sekali user memulai (pilih video / tap play), video berikutnya autoplay saat masuk layar.
let sessionStarted = false

/** Kartu video portrait ala Shorts dengan kontrol custom (YouTube IFrame API):
 *  tap untuk pause/play, mute, subtitle, dan fullscreen sungguhan.
 *  `autoStart` = video ini dipilih user dari beranda, jadi langsung main. */
export default function VideoCard({
  video,
  autoStart = false,
  isFs = false,
  onToggleFs,
  chromeVisible = true,
  onActivity,
}) {
  const cardRef = useRef(null)
  const holderRef = useRef(null) // wadah stabil (React) — iframe YT hidup di dalamnya
  const playerRef = useRef(null)
  const flashTimer = useRef(null)
  const watchdog = useRef(null)

  const [active, setActive] = useState(autoStart) // apakah kartu ini punya player hidup
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [ccOn, setCcOn] = useState(false)
  const [hasCc, setHasCc] = useState(false)
  const [flash, setFlash] = useState(null) // 'play' | 'pause' — ikon kilat saat tap

  useEffect(() => {
    if (autoStart) sessionStarted = true
  }, [autoStart])

  // Terlihat di layar -> aktifkan player; keluar layar -> matikan (hemat memori).
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6
        if (visible) {
          if (sessionStarted || autoStart) setActive(true)
        } else {
          setActive(false)
        }
      },
      { threshold: [0, 0.6, 1] },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [autoStart])

  // Buat / hancurkan player saat status aktif berubah.
  useEffect(() => {
    if (!active) return undefined
    let cancelled = false

    loadYouTubeApi().then((YT) => {
      if (cancelled || !holderRef.current) return
      // Penting: beri YT sebuah div ANAK buatan manual (bukan node milik React).
      // YT mengganti node itu dengan <iframe>. Karena React hanya mengelola
      // holderRef (yang selalu kosong menurut React), tidak ada konflik DOM saat
      // kartu di-scroll & di-unmount -> mencegah bug layar hitam.
      const inner = document.createElement('div')
      holderRef.current.appendChild(inner)

      playerRef.current = new YT.Player(inner, {
        videoId: video.id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          controls: 0, // kita pakai kontrol custom
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
        },
        events: {
          onReady: (e) => {
            e.target.playVideo()
            setMuted(e.target.isMuted())
            // Watchdog: bila autoplay bersuara diblokir browser, video tak kunjung
            // main. Setelah jeda, mulai dalam keadaan bisu (autoplay bisu selalu
            // diizinkan) supaya tak ada layar hitam saat scroll.
            clearTimeout(watchdog.current)
            watchdog.current = setTimeout(() => {
              const p = playerRef.current
              if (!p) return
              if (p.getPlayerState?.() !== window.YT.PlayerState.PLAYING) {
                try {
                  p.mute()
                  p.playVideo()
                  setMuted(true)
                } catch {
                  /* abaikan */
                }
              }
            }, 1200)
          },
          onStateChange: (e) => {
            const S = window.YT.PlayerState
            if (e.data === S.PLAYING) {
              setPlaying(true)
              clearTimeout(watchdog.current)
            } else if (e.data === S.PAUSED || e.data === S.ENDED) {
              setPlaying(false)
            }
            // Cek ketersediaan subtitle setelah mulai main.
            try {
              const tracks = e.target.getOption('captions', 'tracklist')
              setHasCc(Array.isArray(tracks) && tracks.length > 0)
            } catch {
              /* modul captions belum siap */
            }
          },
        },
      })
    })

    return () => {
      cancelled = true
      clearTimeout(watchdog.current)
      const p = playerRef.current
      const holder = holderRef.current
      playerRef.current = null
      setPlaying(false)
      setCcOn(false)
      setHasCc(false)
      if (p && typeof p.destroy === 'function') {
        try {
          p.destroy()
        } catch {
          /* abaikan */
        }
      }
      // Bersihkan sisa iframe non-React di dalam wadah.
      if (holder) holder.innerHTML = ''
    }
  }, [active, video.id])

  const flashIcon = useCallback((kind) => {
    setFlash(kind)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 450)
  }, [])

  // Tap di area video -> pause/play sungguhan (seperti YouTube).
  const togglePlay = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    const S = window.YT?.PlayerState
    if (p.getPlayerState() === S?.PLAYING) {
      p.pauseVideo()
      flashIcon('pause')
    } else {
      p.playVideo()
      flashIcon('play')
    }
  }, [flashIcon])

  const start = useCallback(() => {
    sessionStarted = true
    setActive(true)
  }, [])

  const toggleMute = useCallback((e) => {
    e.stopPropagation()
    const p = playerRef.current
    if (!p) return
    if (p.isMuted()) {
      p.unMute()
      setMuted(false)
    } else {
      p.mute()
      setMuted(true)
    }
  }, [])

  const toggleCc = useCallback(
    (e) => {
      e.stopPropagation()
      const p = playerRef.current
      if (!p) return
      try {
        if (ccOn) {
          p.setOption('captions', 'track', {})
          setCcOn(false)
        } else {
          const tracks = p.getOption('captions', 'tracklist') || []
          if (tracks.length) {
            p.setOption('captions', 'track', tracks[0])
            setCcOn(true)
          }
        }
      } catch {
        /* modul captions tidak tersedia */
      }
    },
    [ccOn],
  )

  const toggleFs = useCallback(
    (e) => {
      e.stopPropagation()
      onToggleFs?.()
    },
    [onToggleFs],
  )

  // Tap area video: pause/play + munculkan kembali UI atas (reset timer sembunyi).
  const onTap = useCallback(() => {
    togglePlay()
    onActivity?.()
  }, [togglePlay, onActivity])

  return (
    <section className="card" ref={cardRef}>
      {video.thumbnail && (
        <div
          className="backdrop"
          style={{ backgroundImage: `url(${video.thumbnail})` }}
          aria-hidden="true"
        />
      )}

      <div className="stage">
        <div className="player">
          {active ? (
            <>
              <div ref={holderRef} className="yt-holder" />

              {/* Poster (thumbnail) sampai video benar-benar main -> cegah layar hitam. */}
              {!playing && video.thumbnail && (
                <div
                  className="poster"
                  style={{ backgroundImage: `url(${video.thumbnail})` }}
                  aria-hidden="true"
                />
              )}

              {/* Lapisan tap: pause/play. Membiarkan swipe scroll lewat. */}
              <div className="tap-catch" onClick={onTap} aria-hidden="true" />

              {flash && (
                <div className="tap-flash" aria-hidden="true">
                  <span className="tap-flash-ic">{flash === 'pause' ? '❚❚' : '▶'}</span>
                </div>
              )}

              {/* Kluster kontrol kanan-atas (ikut sembunyi bersama UI atas) */}
              <div className={`pctrl${chromeVisible ? '' : ' hidden'}`}>
                <button
                  type="button"
                  className="pctrl-btn"
                  onClick={toggleMute}
                  aria-label={muted ? 'Bunyikan' : 'Bisukan'}
                  title={muted ? 'Bunyikan' : 'Bisukan'}
                >
                  {muted ? <IconMuted /> : <IconVolume />}
                </button>

                {hasCc && (
                  <button
                    type="button"
                    className={`pctrl-btn${ccOn ? ' on' : ''}`}
                    onClick={toggleCc}
                    aria-label="Subtitle"
                    title="Subtitle"
                  >
                    <IconCc />
                  </button>
                )}

                <button
                  type="button"
                  className="pctrl-btn"
                  onClick={toggleFs}
                  aria-label={isFs ? 'Keluar layar penuh' : 'Layar penuh'}
                  title={isFs ? 'Keluar layar penuh' : 'Layar penuh'}
                >
                  {isFs ? <IconCompress /> : <IconExpand />}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="thumb"
              onClick={start}
              aria-label={`Putar: ${video.title}`}
              style={video.thumbnail ? { backgroundImage: `url(${video.thumbnail})` } : undefined}
            >
              <span className="play" aria-hidden="true">▶</span>
            </button>
          )}
        </div>
      </div>

      <div className="overlay">
        <div className="badges">
          <span className="badge">{video.channel}</span>
          {video.durationSec ? <span className="dur">{formatDur(video.durationSec)}</span> : null}
        </div>
        <h2>{video.title}</h2>
      </div>
    </section>
  )
}

function formatDur(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

/* --- Ikon (SVG, stroke mengikuti currentColor) --- */
function IconVolume() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M3 10v4h4l5 5V5L7 10H3z" />
      <path
        d="M16 8.5a4 4 0 0 1 0 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconMuted() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M3 10v4h4l5 5V5L7 10H3z" />
      <path
        d="M16 9l5 6M21 9l-5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconCc() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm4.2 6.7c0-.5.4-.8.9-.8s.8.2 1 .6l1.4-.7C11 8.7 10 8.1 9 8.1c-1.6 0-2.9 1.1-2.9 3.1s1.3 3.1 2.9 3.1c1 0 2-.5 2.5-1.6l-1.4-.7c-.2.4-.5.6-1 .6s-.9-.3-.9-.8v-1.2zm7 0c0-.5.4-.8.9-.8s.8.2 1 .6l1.4-.7c-.5-1.1-1.5-1.6-2.5-1.6-1.6 0-2.9 1.1-2.9 3.1s1.3 3.1 2.9 3.1c1 0 2-.5 2.5-1.6l-1.4-.7c-.2.4-.5.6-1 .6s-.9-.3-.9-.8v-1.2z" />
    </svg>
  )
}
function IconExpand() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}
function IconCompress() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8h3a1 1 0 0 0 1-1V4M20 8h-3a1 1 0 0 1-1-1V4M4 16h3a1 1 0 0 1 1 1v3M20 16h-3a1 1 0 0 0-1 1v3" />
    </svg>
  )
}
