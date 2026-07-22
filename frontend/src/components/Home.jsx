import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFeed } from '../lib/api'

const SKELETON_COUNT = 8

/** Beranda ala medsos: grid thumbnail pilihan. Pilih satu -> masuk feed mulai
 *  dari video itu, lalu scroll acak. Saat pustaka masih diisi (DB kosong), tampil
 *  skeleton dan otomatis mencoba lagi sampai video tersedia (tanpa layar kosong). */
export default function Home({ onSelect }) {
  const [videos, setVideos] = useState([])
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchFeed(12)
      if (!alive.current) return
      if (data.videos && data.videos.length) {
        setVideos(data.videos)
        setPhase('ready')
      } else {
        setPhase('loading') // pustaka masih diisi -> effect polling akan coba lagi
      }
    } catch {
      if (alive.current) setPhase('error')
    }
  }, [])

  // Muat sekali saat mount.
  useEffect(() => {
    alive.current = true
    load()
    return () => {
      alive.current = false
    }
  }, [load])

  // Selama belum ready (pustaka masih diisi / server belum siap), coba ulang tiap 4 dtk.
  useEffect(() => {
    if (phase === 'ready') return undefined
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [phase, load])

  const refresh = () => {
    setPhase('loading')
    load()
  }

  const ready = phase === 'ready'

  return (
    <div className="home">
      <div className="home-pattern" aria-hidden="true" />

      <header className="home-head">
        <p className="bismillah" dir="rtl" lang="ar">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
        <div className="home-mark" aria-hidden="true">۞</div>
        <h1 className="home-brand">SunnahScroll</h1>
        <p className="home-tagline">Kajian sunnah pilihan — tanpa yang sia-sia.</p>
      </header>

      <section className="home-section">
        <div className="home-section-head">
          <h2>Pilihan untukmu</h2>
          <button className="ghost-btn" onClick={refresh} disabled={!ready}>
            ↻ Lainnya
          </button>
        </div>

        {ready ? (
          <div className="grid">
            {videos.map((v) => (
              <button key={v.id} type="button" className="tile" onClick={() => onSelect(v)}>
                <div
                  className="tile-thumb"
                  style={v.thumbnail ? { backgroundImage: `url(${v.thumbnail})` } : undefined}
                >
                  {v.durationSec ? <span className="tile-dur">{formatDur(v.durationSec)}</span> : null}
                  <span className="tile-play" aria-hidden="true">▶</span>
                </div>
                <div className="tile-meta">
                  <p className="tile-title">{v.title}</p>
                  <p className="tile-channel">{v.channel}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="grid" aria-hidden="true">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} className="tile skeleton">
                  <div className="tile-thumb" />
                  <div className="tile-meta">
                    <span className="sk-line" />
                    <span className="sk-line short" />
                  </div>
                </div>
              ))}
            </div>
            <p className="home-note">
              {phase === 'error'
                ? 'Menyambung ke server… otomatis dicoba lagi.'
                : 'Menyiapkan kajian pilihan untukmu…'}
            </p>
          </>
        )}
      </section>

      {ready && (
        <button className="enter-feed" type="button" onClick={() => onSelect(videos[0])}>
          Mulai scroll acak ↓
        </button>
      )}

      <p className="home-foot">﴾ Barakallahu fiikum ﴿</p>
    </div>
  )
}

function formatDur(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}
