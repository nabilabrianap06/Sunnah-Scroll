"""Wrapper hemat-kuota untuk YouTube Data API v3.

Strategi kuota (gratis 10.000 unit/hari; search.list = 100 unit — dihindari):
  channels.list  (1 unit)      -> uploads playlist id
  playlistItems.list (1 unit)  -> daftar videoId terbaru
  videos.list  (1 unit / 50)   -> durasi + snippet
"""
import re

import httpx

import config

API_BASE = "https://www.googleapis.com/youtube/v3"

_ISO_DUR = re.compile(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?")


class YouTubeError(Exception):
    pass


def parse_iso8601_duration(s: str) -> int:
    """'PT2M30S' -> 150 (detik). String kosong / tak valid -> 0."""
    m = _ISO_DUR.fullmatch(s or "")
    if not m:
        return 0
    h, mi, se = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + se


async def _get(client: httpx.AsyncClient, endpoint: str, params: dict) -> dict:
    params = {**params, "key": config.YOUTUBE_API_KEY}
    r = await client.get(f"{API_BASE}/{endpoint}", params=params)
    if r.status_code != 200:
        raise YouTubeError(f"{endpoint} HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


async def get_uploads_playlist(client: httpx.AsyncClient, channel_id: str) -> str | None:
    data = await _get(client, "channels", {"part": "contentDetails", "id": channel_id})
    items = data.get("items", [])
    if not items:
        return None
    return items[0]["contentDetails"]["relatedPlaylists"].get("uploads")


async def list_recent_uploads(client: httpx.AsyncClient, playlist_id: str, n: int) -> list[str]:
    """Ambil sampai `n` videoId terbaru dari uploads playlist, dengan paginasi.

    playlistItems.list = 1 unit / 50 video. n=200 -> 4 unit per channel.
    """
    ids: list[str] = []
    page_token = None
    while len(ids) < n:
        params = {
            "part": "contentDetails",
            "playlistId": playlist_id,
            "maxResults": 50,
        }
        if page_token:
            params["pageToken"] = page_token
        data = await _get(client, "playlistItems", params)
        for it in data.get("items", []):
            vid = it.get("contentDetails", {}).get("videoId")
            if vid:
                ids.append(vid)
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return ids[:n]


async def get_video_details(client: httpx.AsyncClient, ids: list[str]) -> list[dict]:
    """Ambil detail untuk banyak videoId (di-chunk per 50). Kembalikan list dict ternormalisasi."""
    if not ids:
        return []
    items = []
    for i in range(0, len(ids), 50):
        data = await _get(client, "videos", {
            "part": "contentDetails,snippet",
            "id": ",".join(ids[i:i + 50]),
        })
        items.extend(data.get("items", []))
    out = []
    for it in items:
        snip = it.get("snippet", {})
        cont = it.get("contentDetails", {})
        thumbs = snip.get("thumbnails", {})
        thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
        out.append({
            "id": it["id"],
            "title": snip.get("title", ""),
            "description": snip.get("description", ""),
            "channel": snip.get("channelTitle", ""),
            "channelId": snip.get("channelId", ""),
            "publishedAt": snip.get("publishedAt", ""),
            "durationSec": parse_iso8601_duration(cont.get("duration", "")),
            "thumbnail": thumb,
        })
    return out
