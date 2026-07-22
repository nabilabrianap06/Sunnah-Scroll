import { useCallback, useEffect, useRef } from 'react'
import VideoCard from '../components/VideoCard'

export default function Feed({ videos, onLoadMore, onBack }) {
  const feedRef = useRef(null)

  // Pindah antar-video secara terprogram (tidak bergantung scroll di atas iframe).
  const go = useCallback((dir) => {
    const feed = feedRef.current
    if (!feed) return
    feed.scrollBy({ top: dir * feed.clientHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowDown', 'PageDown', 'j'].includes(e.key)) {
        e.preventDefault()
        go(1)
      } else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) {
        e.preventDefault()
        go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // Infinite scroll: muat lagi saat mendekati ~2 layar dari bawah.
  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return
    const onScroll = () => {
      if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - feed.clientHeight * 2) {
        onLoadMore?.()
      }
    }
    feed.addEventListener('scroll', onScroll, { passive: true })
    return () => feed.removeEventListener('scroll', onScroll)
  }, [onLoadMore])

  return (
    <>
      <div className="feed-top">
        <button type="button" className="back-btn" onClick={onBack} aria-label="Kembali ke beranda">
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="brand">SunnahScroll</div>
      </div>

      <div className="feed" ref={feedRef}>
        {videos.map((v, i) => (
          <VideoCard key={v.id} video={v} autoStart={i === 0} />
        ))}
      </div>

      <div className="navcontrols">
        <button type="button" onClick={() => go(-1)} aria-label="Video sebelumnya">
          <span aria-hidden="true">↑</span>
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Video berikutnya">
          <span aria-hidden="true">↓</span>
        </button>
      </div>
    </>
  )
}
