#!/usr/bin/env python3
"""
Aggiorna il feed Instagram di Neutralia.

Fetcha il feed Behold, scarica le thumbnail in `assets/img/instagram/` e
riscrive `assets/data/instagram.json` con URL locali. Le immagini servite
direttamente dal repo non scadono mai (a differenza di quelle Instagram CDN,
valide solo ~6 giorni).

Eseguito da .github/workflows/instagram-feed.yml ogni 6 ore.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
FEED_URL = "https://feeds.behold.so/b1nAJf39h8WrQslhIhzg"
JSON_OUT = ROOT / "assets" / "data" / "instagram.json"
IMG_DIR = ROOT / "assets" / "img" / "instagram"
PROFILE_URL = "https://www.instagram.com/_neutralia_/"
N_POSTS = 5  # 5 post reali + 1 card "vedi tutti" = 6 celle nella griglia
TIMEOUT = 30

UA_FEED = "NeutraliaIGUpdater/1.0 (+https://neutralia.info)"
UA_IMG = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA_FEED})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_image(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA_IMG})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            dest.write_bytes(r.read())
        return True
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        print(f"  ! download failed: {e}", file=sys.stderr)
        return False


def caption_short(text: str | None, max_len: int = 120) -> str:
    if not text:
        return ""
    first = text.strip().split("\n", 1)[0]
    # Tronca al primo punto se prima di max_len, altrimenti taglia duro
    short = first.split(".", 1)[0]
    if len(short) > max_len:
        short = short[:max_len].rstrip() + "…"
    return short


def main() -> int:
    print(f"Fetching {FEED_URL}")
    data = fetch_json(FEED_URL)
    raw_posts = data.get("posts", [])[:N_POSTS]
    print(f"Got {len(raw_posts)} posts from Behold")

    IMG_DIR.mkdir(parents=True, exist_ok=True)

    # Pulisci immagini stantie (non rimuovo .gitkeep)
    for old in IMG_DIR.glob("*.jpg"):
        old.unlink()
    for old in IMG_DIR.glob("*.jpeg"):
        old.unlink()
    for old in IMG_DIR.glob("*.webp"):
        old.unlink()

    out_posts: list[dict] = []
    for i, p in enumerate(raw_posts, start=1):
        thumb_url = p.get("thumbnailUrl") or p.get("mediaUrl")
        permalink = p.get("permalink")
        if not (thumb_url and permalink):
            print(f"  skip #{i}: missing thumbnail or permalink")
            continue

        local_name = f"{i}.jpg"
        local_path = IMG_DIR / local_name
        print(f"  #{i}  {permalink}")
        if not fetch_image(thumb_url, local_path):
            continue

        out_posts.append(
            {
                "permalink": permalink,
                "thumbnailUrl": f"assets/img/instagram/{local_name}",
                "mediaType": p.get("mediaType", "IMAGE"),
                "isReel": bool(p.get("isReel", False)),
                "captionShort": caption_short(p.get("caption")),
            }
        )

    # Sesta cella: link al profilo
    out_posts.append(
        {
            "permalink": PROFILE_URL,
            "thumbnailUrl": "",
            "mediaType": "IMAGE",
            "captionShort": "Vedi tutti i post",
        }
    )

    payload = {
        "_comment": (
            "Generato automaticamente da .github/workflows/instagram-feed.yml "
            "ogni 6 ore. Non modificare a mano."
        ),
        "updatedFrom": raw_posts[0].get("timestamp", "") if raw_posts else "",
        "posts": out_posts,
    }

    JSON_OUT.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(out_posts)} entries to {JSON_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
