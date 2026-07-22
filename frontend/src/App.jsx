import { useCallback, useRef, useState } from 'react'
import { fetchFeed } from './lib/api'
import { enterFullscreen, exitFullscreen } from './lib/fullscreen'
import Home from './components/Home'
import Feed from './pages/Feed'

const BATCH = 20

// Auto layar-penuh saat pilih video hanya di perangkat sentuh (HP) — ala YT Shorts.
// Di desktop tidak dipaksa (tombol layar-penuh tetap tersedia).
const AUTO_FS =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export default function App() {
  const [view, setView] = useState('home') // home | feed
  const [videos, setVideos] = useState([])
  const seen = useRef(new Set())
  const loadingMore = useRef(false)
  const exhausted = useRef(false)

  // Infinite scroll: ambil batch acak baru, buang yang sudah tampil, tambahkan.
  const loadMore = useCallback(async () => {
    if (loadingMore.current || exhausted.current) return
    loadingMore.current = true
    try {
      let fresh = []
      for (let attempt = 0; attempt < 3 && fresh.length === 0; attempt++) {
        const data = await fetchFeed(BATCH)
        fresh = (data.videos || []).filter((v) => !seen.current.has(v.id))
      }
      if (fresh.length === 0) {
        exhausted.current = true
        return
      }
      fresh.forEach((v) => seen.current.add(v.id))
      setVideos((prev) => [...prev, ...fresh])
    } catch {
      /* diamkan; coba lagi saat scroll berikutnya */
    } finally {
      loadingMore.current = false
    }
  }, [])

  // Pilih video dari beranda -> masuk feed mulai dari video itu, lalu langsung
  // muat satu batch agar ada ruang untuk scroll acak.
  const openVideo = useCallback(
    (video) => {
      if (!video) return
      // Masuk immersive langsung dari gesture tap (butuh gesture user agar diizinkan).
      if (AUTO_FS) enterFullscreen()
      seen.current = new Set([video.id])
      exhausted.current = false
      setVideos([video])
      setView('feed')
      loadMore()
    },
    [loadMore],
  )

  const goHome = useCallback(() => {
    exitFullscreen()
    setView('home')
  }, [])

  if (view === 'home') return <Home onSelect={openVideo} />
  return <Feed videos={videos} onLoadMore={loadMore} onBack={goHome} />
}
