"""SunnahScroll API — feed kurasi video pendek ceramah sunnah.

Jalankan dari folder sunnah-feed:
    uvicorn backend.main:app --reload --port 8000

Feed disajikan dari pustaka SQLite (instan). Saat startup: init DB, backfill jika
kosong (latar), lalu sinkron harian menambah video baru.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

import sys
from pathlib import Path

# Add backend directory to sys.path to allow absolute imports in Vercel and local runs
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from routers import channels, feed
from services import database, library

log = logging.getLogger("sunnahscroll")

_SYNC_INTERVAL_SEC = 24 * 60 * 60


async def _bootstrap():
    """Backfill sekali jika DB masih kosong (jalan di latar, tak memblok startup)."""
    try:
        if await database.count_videos() == 0 and config.YOUTUBE_API_KEY:
            log.info("Pustaka kosong -> backfill awal dimulai...")
            result = await library.sync_library()
            log.info("Backfill selesai: %s", result)
    except Exception as e:  # noqa: BLE001 - jangan sampai menjatuhkan startup
        log.warning("Backfill gagal: %s", e)


async def _daily_sync():
    while True:
        await asyncio.sleep(_SYNC_INTERVAL_SEC)
        try:
            result = await library.sync_library()
            log.info("Sinkron harian: %s", result)
        except Exception as e:  # noqa: BLE001
            log.warning("Sinkron harian gagal: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.init_db()
    asyncio.create_task(_bootstrap())
    task = asyncio.create_task(_daily_sync())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="SunnahScroll API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feed.router)
app.include_router(channels.router)


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "hasApiKey": bool(config.YOUTUBE_API_KEY),
        "activeChannels": len(config.load_channels()),
        "libraryVideos": await database.count_videos(),
    }
