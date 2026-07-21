import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFeed } from './lib/api'
import Feed from './pages/Feed'

const BATCH = 20

export default function App() {
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | empty | error
  const [error, setError] = useState('')
  const seen = useRef(new Set())
  const loadingMore = useRef(false)
  const exhausted = useRef(false)

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    seen.current = new Set()
    exhausted.current = false
    try {
      const data = await fetchFeed(BATCH)
      if (!data.videos || data.videos.length === 0) {
        setStatus('empty')
        return
      }
      data.videos.forEach((v) => seen.current.add(v.id))
      setVideos(data.videos)
      setStatus('ready')
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Gagal memuat feed')
      setStatus('error')
    }
  }, [])

  // Infinite scroll: ambil batch acak baru, buang yang sudah tampil, tambahkan.
  const loadMore = useCallback(async () => {
    if (loadingMore.current || exhausted.current) return
    loadingMore.current = true
    try {
      let fresh = []
      // Coba beberapa kali; pool acak bisa mengembalikan yang sudah dilihat.
      for (let attempt = 0; attempt < 3 && fresh.length === 0; attempt++) {
        const data = await fetchFeed(BATCH)
        fresh = (data.videos || []).filter((v) => !seen.current.has(v.id))
      }
      if (fresh.length === 0) {
        exhausted.current = true // sudah lihat (hampir) semua isi pustaka
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

  useEffect(() => {
    load()
  }, [load])

  if (status === 'loading') {
    return (
      <Center>
        <h1>SunnahScroll</h1>
        <p>Memuat kajian…</p>
      </Center>
    )
  }

  if (status === 'error') {
    return (
      <Center>
        <h1>⚠️ Gagal memuat</h1>
        <p>{error}</p>
        <button onClick={load}>Coba lagi</button>
      </Center>
    )
  }

  if (status === 'empty') {
    return (
      <Center>
        <h1>Pustaka sedang disiapkan</h1>
        <p className="hint">
          Video sedang dikumpulkan dari channel di latar belakang. Tunggu sebentar
          lalu muat ulang. (Butuh <code>YOUTUBE_API_KEY</code> + channel di{' '}
          <code>channels.json</code>.)
        </p>
        <button onClick={load}>Muat ulang</button>
      </Center>
    )
  }

  return <Feed videos={videos} onLoadMore={loadMore} />
}

function Center({ children }) {
  return <div className="center">{children}</div>
}
