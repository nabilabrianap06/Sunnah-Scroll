"""Sekali-jalan: temukan channelId dari nama channel (search.list).

Jalankan dari folder sunnah-feed (butuh backend/.env berisi YOUTUBE_API_KEY):
    py -m backend.scripts.resolve_channels

Cetak kandidat channelId per query. Verifikasi manual (buka youtube.com/channel/<id>),
lalu tempel yang benar ke backend/channels.json dan set "enabled": true.

Catatan kuota: search.list = 100 unit/panggil. 10 nama = ~1000 unit (sekali setup, aman).
"""
import asyncio

import httpx

from .. import config

# Sesuaikan daftar ini dengan channel yang ingin kamu kurasi.
NAMES = [
    "Yufid TV",
    "Yufid EDU",
    "Rodja TV",
    "Khalid Basalamah Official",
    "Syafiq Riza Basalamah Official",
    "Firanda Andirja",
    "Adi Hidayat Official",
    "Muslim.or.id",
    "Nasihat Sahabat",
    "Kajian Islam",
]


async def main():
    if not config.YOUTUBE_API_KEY:
        print("YOUTUBE_API_KEY belum diisi di backend/.env")
        return
    async with httpx.AsyncClient(timeout=15) as client:
        for name in NAMES:
            r = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "type": "channel",
                    "q": name,
                    "maxResults": 3,
                    "key": config.YOUTUBE_API_KEY,
                },
            )
            if r.status_code != 200:
                print(f"# {name}: ERROR {r.status_code} {r.text[:120]}")
                continue
            items = r.json().get("items", [])
            print(f"# query: {name}")
            for it in items:
                cid = it["snippet"]["channelId"]
                title = it["snippet"]["title"]
                print(f'  {{ "name": "{title}", "channelId": "{cid}", "enabled": true }},')
            print()


if __name__ == "__main__":
    asyncio.run(main())
