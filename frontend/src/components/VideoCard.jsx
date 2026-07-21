import { useEffect, useRef, useState } from 'react'

// Perangkat sentuh (HP/tablet) -> pakai lapisan penangkap swipe.
const IS_TOUCH =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

// Sekali user tap "play" pertama, video berikutnya autoplay saat masuk layar
// (seperti YT Shorts). Video pertama sengaja TIDAK langsung autoplay.
let sessionStarted = false

/** Kartu video portrait ala Shorts. iframe hanya mount saat main (hemat & auto-pause
 *  saat keluar layar). Di HP, lapisan .tap-catch mengembalikan swipe ke scroll native. */
export default function VideoCard({ video }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6
        if (visible) {
          if (sessionStarted) setPlaying(true) // autoplay video berikutnya
        } else {
          setPlaying(false) // berhenti saat digeser keluar
        }
      },
      { threshold: [0, 0.6, 1] },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const start = () => {
    sessionStarted = true
    setPlaying(true)
  }
  const toggle = () => (playing ? setPlaying(false) : start())

  const embedUrl =
    `https://www.youtube-nocookie.com/embed/${video.id}` +
    `?autoplay=1&rel=0&modestbranding=1&playsinline=1`

  return (
    <section className="card" ref={ref}>
      {video.thumbnail && (
        <div
          className="backdrop"
          style={{ backgroundImage: `url(${video.thumbnail})` }}
          aria-hidden="true"
        />
      )}

      <div className="stage">
        <div className="player">
          {playing ? (
            <iframe
              src={embedUrl}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
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

          {/* HP: saat main, rebut sentuhan dari iframe -> swipe = pindah (scroll native), tap = jeda */}
          {playing && IS_TOUCH && <div className="tap-catch" onClick={toggle} aria-hidden="true" />}
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
