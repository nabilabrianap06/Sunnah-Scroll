"""Resolusi channelId untuk daftar channel, merge & tulis ke channels.json.

Jalankan dari folder sunnah-feed (butuh backend/.env berisi YOUTUBE_API_KEY):
    py -m backend.scripts.build_channels

Merge dengan channels.json yang ada (dedup by channelId). Kuota: search.list =
100 unit/nama. ~55 nama = ~5.500 unit (sekali seumur setup). Verifikasi hasilnya
di channels.json dan set "enabled": false untuk yang salah-cocok.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path to allow absolute imports
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import asyncio
import json

import httpx

import config

# Konsol Windows default cp1252 -> crash saat cetak judul beraksara Arab.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Query pencarian (sudah dinormalisasi dari daftar mentah agar cocok nama channel).
NAMES = [
    "Muhammad Nuzul Dzikri", "Firanda Andirja", "Syafiq Riza Basalamah",
    "Khalid Basalamah", "Ammi Nur Baits", "Erwandi Tarmizi", "HSI AbdullahRoy",
    "Rifky Jafar Thalib", "Rumaysho", "Dr Bobby Jantung", "Hasan Yahya",
    "Husain Yahya", "Abu Layha", "Mohammed Hoblos", "Mohammed Hijab",
    "Iam the Warner", "Uthman ibn Farooq", "Yufid TV", "Rodja TV",
    "MPDTV Masjid Pogung Dalangan", "Shahih Fiqih", "Salaf TV", "Kajian Sunnah",
    "Mahasiswa Salaf", "Seaqidah", "Fawaidharam", "Hadist Lemah", "Bass FM",
    "FKIM Yogyakarta", "Tulisan Hanif", "Mishary Rashid Alafasy",
    "Mansour Al Salmi", "Fatih Seferagic", "Haramain Info", "Haramain Recordings",
    "Imams of Haramain", "Islam Sobhi", "Raad Al Kurdi", "Sahabat Hijaz",
    "Wayoflife SQ", "Saufyvh", "Pemuda Kahfi", "Lantunan Alquran", "Qrnfeed",
    "Quran Haramain voice", "Captain Halal", "Syaikh Rasoul", "Akhi Ayman",
    "Smile2jannah", "Assim Al Hakeem", "Bilal Assad", "Farhan Abu Furaihan",
    "Muflih Safitra", "Afifi Abdul Wadud", "Yasser Al Dosari",
]


async def main():
    if not config.YOUTUBE_API_KEY:
        print("YOUTUBE_API_KEY belum diisi di backend/.env")
        return

    path = config.BASE_DIR / "channels.json"
    existing = json.loads(path.read_text(encoding="utf-8"))
    by_id = {c["channelId"]: c for c in existing if c.get("channelId")}
    start = len(by_id)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            for name in NAMES:
                try:
                    r = await client.get(
                        "https://www.googleapis.com/youtube/v3/search",
                        params={
                            "part": "snippet", "type": "channel", "q": name,
                            "maxResults": 1, "key": config.YOUTUBE_API_KEY,
                        },
                    )
                except httpx.HTTPError as e:
                    print(f"# {name}: NET ERROR {e}")
                    continue
                if r.status_code != 200:
                    print(f"# {name}: HTTP {r.status_code} {r.text[:120]}")
                    continue
                items = r.json().get("items", [])
                if not items:
                    print(f"# {name}: TIDAK DITEMUKAN")
                    continue
                cid = items[0]["snippet"]["channelId"]
                title = items[0]["snippet"]["title"]
                if cid in by_id:
                    print(f"= sudah ada: {title}")
                else:
                    by_id[cid] = {"name": title, "channelId": cid, "enabled": True}
                    print(f"+ {title}  <- '{name}'")
    finally:
        # Simpan apa pun yang sudah didapat, walau loop terputus (jangan buang kuota).
        out = list(by_id.values())
        path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"\nchannels.json: {start} -> {len(out)} channel (+{len(out) - start} baru)")


if __name__ == "__main__":
    asyncio.run(main())
