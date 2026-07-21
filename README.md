# SunnahScroll

Feed kurasi pribadi berbasis web untuk **scroll video pendek ceramah sunnah** dari YouTube —
tanpa algoritma pihak lain yang menggiring ke konten tak pantas. Video diambil hanya dari
**allowlist channel** yang kamu percaya, disaring durasi & kata kunci, lalu diputar lewat
**embed resmi YouTube** (legal, tidak menyalin/menyimpan video).

Stack: FastAPI (backend kurasi + penyembunyi API key) + React/Vite (feed vertikal ala TikTok).

## Cara kerja (hemat kuota)

Kuota gratis YouTube Data API = 10.000 unit/hari. Alih-alih `search.list` (100 unit), pipeline pakai:
`channels.list` (1 unit → uploads playlist) → `playlistItems.list` (1 unit → video terbaru) →
`videos.list` (1 unit/50 → durasi + judul). Refresh seluruh feed hanya puluhan unit.

## Setup

### 1. Dapatkan YouTube API key
1. Buka <https://console.cloud.google.com/> → buat/pilih project.
2. **APIs & Services → Library** → aktifkan **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Salin `backend/.env.example` menjadi `backend/.env`, isi `YOUTUBE_API_KEY=...`.

### 2. Backend
```bash
# dari folder sunnah-feed/
pip install -r backend/requirements.txt

# Temukan channelId dari nama channel (cetak kandidat), tempel ke backend/channels.json
py -m backend.scripts.resolve_channels

# edit backend/channels.json: isi channelId & set "enabled": true untuk channel yang dipakai

uvicorn backend.main:app --reload --port 8000
```
Cek: `GET http://localhost:8000/api/health` dan `GET http://localhost:8000/api/feed`.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy /api -> :8000)
```

## Kurasi

- **`backend/channels.json`** — allowlist channel. Hanya channel dengan `"enabled": true` dan
  `channelId` terisi yang diambil.
- **`backend/keywords.json`** — `blocklist` (buang jika judul/deskripsi mengandung kata ini) dan
  `allowlist` (jika diisi, hanya loloskan yang cocok).
- Parameter durasi/refresh diatur di `backend/.env` (`MAX_SHORT_SECONDS`, dll).

## Di luar scope versi ini

Login/multi-user, posting, algoritma rekomendasi personal, classifier AI (v2), TikTok/IG.
