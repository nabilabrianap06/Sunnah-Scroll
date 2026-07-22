// Helper Fullscreen API lintas-browser.
//
// PENTING: fullscreen dipasang pada documentElement (SELURUH halaman), bukan pada
// satu kartu video. Kalau hanya satu kartu yang di-fullscreen, browser mengunci ke
// elemen itu dan scroll ke video lain jadi mati. Dengan memfullscreen-kan seluruh
// halaman, container feed tetap di dalam layar penuh sehingga scroll/swipe tetap jalan.

export function enterFullscreen() {
  const el = document.documentElement
  const fn = el.requestFullscreen || el.webkitRequestFullscreen
  if (!fn) return
  try {
    const p = fn.call(el)
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch {
    /* diabaikan (mis. iOS pada elemen non-video) */
  }
}

export function exitFullscreen() {
  if (!isFullscreen()) return
  const fn = document.exitFullscreen || document.webkitExitFullscreen
  if (!fn) return
  try {
    const p = fn.call(document)
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch {
    /* diabaikan */
  }
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement)
}
