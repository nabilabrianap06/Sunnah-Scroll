// Loader untuk YouTube IFrame Player API. Dimuat sekali, di-cache sebagai promise.
// Dengan API ini kita kontrol video sendiri (play/pause/mute/fullscreen) lewat
// tombol custom, jadi terasa seperti aplikasi Shorts sungguhan.

let apiPromise = null

export function loadYouTubeApi() {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT)
      return
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(window.YT)
    }
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
  return apiPromise
}
