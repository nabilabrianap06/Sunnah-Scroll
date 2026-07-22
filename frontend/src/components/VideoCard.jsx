import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { loadYouTubeApi } from '../lib/youtube'
import avatars from '../data/channel_avatars.json'

// Sekali user memulai (pilih video / tap play), video berikutnya autoplay saat masuk layar.
let sessionStarted = false
// Preferensi suara global (bertahan antar-video). Default: bersuara. Diubah saat user
// tekan tombol mute. Dipakai agar suara tak "hilang sendiri" tiap ganti video.
let preferMuted = false

/** Kartu video portrait ala Shorts dengan kontrol custom (YouTube IFrame API):
 *  tap untuk pause/play + mute + subtitle + fullscreen. Kontrol muncul saat di-pause.
 *  `autoStart` = video ini dipilih user dari beranda, jadi langsung main. */
function VideoCard({ video, autoStart = false, isFs = false, onToggleFs, onPausedChange }) {
  const cardRef = useRef(null)
  const holderRef = useRef(null) // wadah stabil (React) — iframe YT hidup di dalamnya
  const playerRef = useRef(null)
  const flashTimer = useRef(null)
  const watchdog = useRef(null)

  const [active, setActive] = useState(autoStart) // apakah kartu ini punya player hidup
  const [avatarOk, setAvatarOk] = useState(true) // avatar channel berhasil dimuat?
  const [started, setStarted] = useState(false) // sudah pernah main? -> poster dilepas
  const [paused, setPaused] = useState(false) // di-pause user? -> kontrol muncul
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

  // Lapor status pause ke Feed (untuk menampilkan bar atas hanya saat pause).
  useEffect(() => {
    onPausedChange?.(active ? paused : false)
  }, [active, paused, onPausedChange])

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
            // Ikuti preferensi suara user (kalau sebelumnya membisukan, tetap bisu).
            if (preferMuted) e.target.mute()
            e.target.playVideo()
            setMuted(e.target.isMuted())
            // Watchdog: HANYA sebagai jaring pengaman bila autoplay bersuara benar-benar
            // diblokir (player mentok UNSTARTED/CUED). JANGAN bisukan video yang sekadar
            // BUFFERING (loading lambat) — itu penyebab suara "hilang" saat scroll.
            clearTimeout(watchdog.current)
            watchdog.current = setTimeout(() => {
              const p = playerRef.current
              if (!p) return
              const S = window.YT.PlayerState
              const st = p.getPlayerState?.()
              if (st === S.UNSTARTED || st === S.CUED) {
                try {
                  p.mute()
                  p.playVideo()
                  setMuted(true)
                } catch {
                  /* abaikan */
                }
              }
            }, 2500)
          },
          onStateChange: (e) => {
            const S = window.YT.PlayerState
            if (e.data === S.PLAYING) {
              setStarted(true)
              setPaused(false)
              clearTimeout(watchdog.current)
            } else if (e.data === S.PAUSED || e.data === S.ENDED) {
              setPaused(true)
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
      setStarted(false)
      setPaused(false)
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
  const onTap = useCallback(() => {
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
      preferMuted = false
      setMuted(false)
    } else {
      p.mute()
      preferMuted = true
      setMuted(true)
    }
  }, [])

  const toggleFs = useCallback(
    (e) => {
      e.stopPropagation()
      onToggleFs?.()
    },
    [onToggleFs],
  )

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

              {/* Poster HANYA sebelum video pertama kali main -> cegah layar hitam saat
                  loading. Setelah main, saat di-pause tampil frame video (bukan poster). */}
              {!started && video.thumbnail && (
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

              {/* Kontrol kanan-atas (fullscreen + subtitle) — muncul saat di-pause. */}
              <div className={`pctrl${paused ? '' : ' hidden'}`}>
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

              {/* Tombol volume di tengah, sedikit di bawah ikon play — muncul saat pause. */}
              <button
                type="button"
                className={`vol-btn${paused ? '' : ' hidden'}`}
                onClick={toggleMute}
                aria-label={muted ? 'Bunyikan' : 'Bisukan'}
                title={muted ? 'Bunyikan' : 'Bisukan'}
              >
                {muted ? <IconMuted /> : <IconVolume />}
              </button>
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
        <div className="ov-row">
          <span className="ov-logo" aria-hidden="true">
            {avatars[video.channelId] && avatarOk ? (
              <img
                src={avatars[video.channelId]}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setAvatarOk(false)}
              />
            ) : (
              initial(video.channel)
            )}
          </span>
          <span className="ov-channel">{video.channel}</span>
          {video.durationSec ? <span className="dur">{formatDur(video.durationSec)}</span> : null}
        </div>
        <h2>{video.title}</h2>
      </div>
    </section>
  )
}

// Memo: kartu tak perlu render ulang saat state Feed (mis. status pause aktif) berubah.
export default memo(VideoCard)

function formatDur(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function initial(name) {
  const c = (name || '').trim()[0]
  return c ? c.toUpperCase() : '۞'
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
