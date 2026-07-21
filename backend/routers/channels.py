from fastapi import APIRouter

import config

router = APIRouter(prefix="/api", tags=["channels"])


@router.get("/channels")
async def list_channels():
    """Lihat allowlist channel yang aktif (untuk debugging/kurasi)."""
    return {"channels": config.load_channels()}
