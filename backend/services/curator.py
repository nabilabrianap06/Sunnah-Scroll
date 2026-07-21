"""Pipeline kurasi: gabung channel allowlist -> filter durasi & keyword -> daftar video.

Dipakai oleh library.sync_library() untuk mengisi database. Feed membaca dari DB.
"""
import httpx

from .. import config
from . import youtube
from .cache import TTLCache

# Uploads playlist id jarang berubah -> cache 24 jam (hemat kuota antar-sinkron).
_uploads_cache = TTLCache(ttl=60 * 60 * 24)


def _passes_duration(video: dict) -> bool:
    d = video.get("durationSec", 0)
    return config.MIN_SHORT_SECONDS <= d <= config.MAX_SHORT_SECONDS


def _passes_keyword_filter(video: dict, keywords: dict) -> bool:
    text = f"{video.get('title', '')} {video.get('description', '')}".lower()
    block = [w.lower() for w in keywords.get("blocklist", []) if w]
    allow = [w.lower() for w in keywords.get("allowlist", []) if w]
    if any(w in text for w in block):
        return False
    if allow and not any(w in text for w in allow):
        return False
    return True


async def _uploads_playlist_id(client: httpx.AsyncClient, channel_id: str) -> str | None:
    cached = _uploads_cache.get(channel_id)
    if cached:
        return cached
    pid = await youtube.get_uploads_playlist(client, channel_id)
    if pid:
        _uploads_cache.set(channel_id, pid)
    return pid


async def build_feed() -> list[dict]:
    """Bangun feed dari nol (memanggil YouTube API). Lempar YouTubeError jika API key kosong."""
    if not config.YOUTUBE_API_KEY:
        raise youtube.YouTubeError("YOUTUBE_API_KEY belum diisi di backend/.env")

    channels = config.load_channels()
    keywords = config.load_keywords()
    videos: list[dict] = []
    seen: set[str] = set()

    async with httpx.AsyncClient(timeout=15) as client:
        for ch in channels:
            try:
                pid = await _uploads_playlist_id(client, ch["channelId"])
                if not pid:
                    continue
                ids = await youtube.list_recent_uploads(client, pid, config.UPLOADS_PER_CHANNEL)
                details = await youtube.get_video_details(client, ids)
            except youtube.YouTubeError:
                # Satu channel gagal tak boleh menjatuhkan seluruh feed.
                continue
            for v in details:
                if v["id"] in seen:
                    continue
                if not _passes_duration(v) or not _passes_keyword_filter(v, keywords):
                    continue
                seen.add(v["id"])
                # Buang description dari payload keluaran (sudah dipakai untuk filter).
                v.pop("description", None)
                videos.append(v)

    return videos  # daftar terkurasi; disimpan ke DB oleh library.sync_library()
