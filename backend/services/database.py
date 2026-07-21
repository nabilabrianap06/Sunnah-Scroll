"""Pustaka video permanen (SQLite). Menumpuk, tidak pernah menghapus.

Feed disajikan instan dari sini; pengambilan YouTube hanya saat sinkron latar.
Pakai sqlite3 stdlib + asyncio.to_thread agar tidak memblok event loop.
"""
import asyncio
import sqlite3
import threading
from datetime import datetime, timezone
import os
from pathlib import Path

if os.getenv("VERCEL"):
    DB_PATH = Path("/tmp/sunnah_feed.db")
else:
    DB_PATH = Path(__file__).resolve().parent.parent / "sunnah_feed.db"

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute(
            """
            CREATE TABLE IF NOT EXISTS videos (
                id           TEXT PRIMARY KEY,
                title        TEXT,
                channel      TEXT,
                channel_id   TEXT,
                published_at TEXT,
                duration_sec INTEGER,
                thumbnail    TEXT,
                added_at     TEXT
            )
            """
        )
        _conn.commit()
    return _conn


def _upsert_sync(videos: list[dict]) -> int:
    conn = _connect()
    now = datetime.now(timezone.utc).isoformat()
    added = 0
    with _lock:
        for v in videos:
            cur = conn.execute(
                """INSERT OR IGNORE INTO videos
                   (id, title, channel, channel_id, published_at, duration_sec, thumbnail, added_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    v["id"], v.get("title"), v.get("channel"), v.get("channelId"),
                    v.get("publishedAt"), v.get("durationSec"), v.get("thumbnail"), now,
                ),
            )
            added += cur.rowcount
        conn.commit()
    return added


def _random_sync(limit: int) -> list[dict]:
    conn = _connect()
    with _lock:
        rows = conn.execute(
            """SELECT id, title, channel,
                      published_at AS publishedAt,
                      duration_sec AS durationSec,
                      thumbnail
               FROM videos ORDER BY RANDOM() LIMIT ?""",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def _count_sync() -> int:
    conn = _connect()
    with _lock:
        return conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0]


async def init_db() -> None:
    await asyncio.to_thread(_connect)


async def upsert_videos(videos: list[dict]) -> int:
    if not videos:
        return 0
    return await asyncio.to_thread(_upsert_sync, videos)


async def random_videos(limit: int) -> list[dict]:
    return await asyncio.to_thread(_random_sync, limit)


async def count_videos() -> int:
    return await asyncio.to_thread(_count_sync)
