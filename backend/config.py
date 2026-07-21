"""Konfigurasi & pemuatan sumber kurasi (channels + keywords).

Baca YOUTUBE_API_KEY dan parameter filter dari backend/.env.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip()

# Parameter filter (punya default; bisa dioverride lewat .env)
MAX_SHORT_SECONDS = int(os.getenv("MAX_SHORT_SECONDS", "300"))
MIN_SHORT_SECONDS = int(os.getenv("MIN_SHORT_SECONDS", "0"))
UPLOADS_PER_CHANNEL = int(os.getenv("UPLOADS_PER_CHANNEL", "200"))
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "1800"))


def load_channels():
    """Kembalikan channel yang aktif & punya channelId dari channels.json."""
    with open(BASE_DIR / "channels.json", encoding="utf-8") as f:
        data = json.load(f)
    return [c for c in data if c.get("enabled", True) and c.get("channelId")]


def load_keywords():
    """Kembalikan dict {'blocklist': [...], 'allowlist': [...]} dari keywords.json."""
    with open(BASE_DIR / "keywords.json", encoding="utf-8") as f:
        data = json.load(f)
    return {
        "blocklist": data.get("blocklist", []),
        "allowlist": data.get("allowlist", []),
    }
