// Feed disajikan sepenuhnya di sisi klien dari seed statis (videos_seed.json)
// yang di-serve sebagai aset CDN. Tak ada backend/serverless di jalur kritis:
// tak ada cold start, tak ada kuota YouTube, beranda tampil instan.

const SEED_URL = '/videos_seed.json'

let seedPromise = null

/** Muat seed sekali lalu cache di memori (fetch di-dedup). */
function loadSeed() {
  if (!seedPromise) {
    seedPromise = fetch(SEED_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`seed ${r.status}`)
        return r.json()
      })
      .catch((e) => {
        seedPromise = null // biar bisa dicoba lagi saat pemanggilan berikutnya
        throw e
      })
  }
  return seedPromise
}

/** Ambil `n` item acak tanpa duplikat (Fisher–Yates parsial). */
function sample(list, n) {
  const k = Math.min(n, list.length)
  const a = list.slice()
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, k)
}

/** Sampel acak dari pustaka. Tiap panggilan diacak ulang (infinite scroll). */
export async function fetchFeed(limit = 30) {
  const seed = await loadSeed()
  return { count: Math.min(limit, seed.length), total: seed.length, videos: sample(seed, limit) }
}

/** Kompat: dulu memicu sinkron server; kini cukup sampel acak baru. */
export const refreshFeed = fetchFeed

export default { fetchFeed, refreshFeed }
