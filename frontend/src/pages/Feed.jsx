import { useCallback, useEffect, useRef } from 'react'
import VideoCard from '../components/VideoCard'

export default function Feed({ videos, onLoadMore }) {
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
      <div className="brand">SunnahScroll</div>

      <div className="feed" ref={feedRef}>
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
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
