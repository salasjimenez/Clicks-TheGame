#!/usr/bin/env python3
"""Optimize local raster assets before packaging. Never runs in the browser."""
from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow is required: python -m pip install -r tools/requirements.txt") from exc

ROOT = Path(__file__).resolve().parents[1]
SEARCH_ROOTS = [ROOT / "assets", ROOT / "src" / "assets"]
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".m4a", ".aac", ".flac"}


def optimize(path: Path, check_only: bool) -> tuple[int, int]:
    before = path.stat().st_size
    with Image.open(path) as image:
        image.load()
        suffix = path.suffix.lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=path.parent) as tmp:
            temp_path = Path(tmp.name)
        try:
            if suffix == ".png":
                image.save(temp_path, format="PNG", optimize=True, compress_level=9)
            elif suffix in {".jpg", ".jpeg"}:
                converted = image.convert("RGB") if image.mode not in {"RGB", "L"} else image
                converted.save(temp_path, format="JPEG", optimize=True, progressive=True, quality=88)
            elif suffix == ".webp":
                image.save(temp_path, format="WEBP", method=6, quality=88)
            after = temp_path.stat().st_size
            if not check_only and after < before:
                os.replace(temp_path, path)
            else:
                temp_path.unlink(missing_ok=True)
            return before, min(before, after)
        finally:
            temp_path.unlink(missing_ok=True)


def all_asset_files() -> set[Path]:
    return {path for root in SEARCH_ROOTS if root.exists() for path in root.rglob("*") if path.is_file()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="decode/measure assets without modifying them")
    args = parser.parse_args()
    all_files = all_asset_files()
    images = sorted(path for path in all_files if path.suffix.lower() in IMAGE_EXTENSIONS)
    audio = sorted(path for path in all_files if path.suffix.lower() in AUDIO_EXTENSIONS)
    total_before = total_after = 0
    for path in images:
        before, after = optimize(path, args.check)
        total_before += before
        total_after += after
        print(f"{path.relative_to(ROOT)}: {before} -> {after} bytes")
    saved = total_before - total_after
    if audio:
        print("INFO audio assets are present but are not transcoded by this Pillow-only tool:")
        for path in audio:
            print(f"  {path.relative_to(ROOT)}: {path.stat().st_size} bytes")
    else:
        print("INFO audio_assets=0; game audio is synthesized at runtime, so there are no audio files to compress.")
    print(f"OK images={len(images)} before={total_before} after={total_after} saved={saved} audio_assets={len(audio)}")


if __name__ == "__main__":
    main()
