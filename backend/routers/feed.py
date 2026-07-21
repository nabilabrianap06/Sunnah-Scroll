from fastapi import APIRouter, HTTPException, Query

from ..services import database, library
from ..services.youtube import YouTubeError

router = APIRouter(prefix="/api", tags=["feed"])


@router.get("/feed")
async def get_feed(limit: int = Query(30, ge=1, le=100)):
    """Sajikan sampel acak dari pustaka DB (instan, tanpa kuota YouTube).

    Tiap permintaan diacak (ORDER BY RANDOM), jadi tiap refresh/user beda urutan.
    Frontend memanggil berulang (infinite scroll) untuk terus menambah video.
    """
    videos = await database.random_videos(limit)
    total = await database.count_videos()
    return {"count": len(videos), "total": total, "videos": videos}


@router.post("/sync")
async def sync():
    """Picu sinkron pustaka manual (ambil video baru dari YouTube -> DB)."""
    try:
        return await library.sync_library()
    except YouTubeError as e:
        raise HTTPException(status_code=502, detail=str(e))
