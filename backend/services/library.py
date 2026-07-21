"""Sinkron pustaka: ambil + saring video dari semua channel, tumpuk ke database.

Dipakai saat backfill awal (DB kosong) dan sinkron harian. Feed TIDAK memanggil
ini; feed hanya membaca dari database (instan, tanpa kuota).
"""
from . import curator, database

_syncing = False


async def sync_library() -> dict:
    """Fetch+filter semua channel lalu upsert ke DB. Aman dipanggil berulang."""
    global _syncing
    if _syncing:
        return {"skipped": True, "reason": "sync sedang berjalan"}
    _syncing = True
    try:
        videos = await curator.build_feed()  # fetch + filter durasi/keyword
        added = await database.upsert_videos(videos)
        total = await database.count_videos()
        return {"fetched": len(videos), "added": added, "total": total}
    finally:
        _syncing = False
