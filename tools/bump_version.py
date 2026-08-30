#!/usr/bin/env python3
"""Update CLICK! version strings in package metadata, HTML and README."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def update_json(path: Path, version: str, lock: bool = False) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    if lock and isinstance(data.get("packages"), dict) and isinstance(data["packages"].get(""), dict):
        data["packages"][""]["version"] = version
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def replace_text(path: Path, version: str) -> None:
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"(?i)CLICK!\s+v\d+\.\d+(?:\.\d+)?", f"CLICK! v{version}", text)
    text = re.sub(r"(?i)CLICK!\s+v2(?![.\d])", f"CLICK! v{version}", text)
    text = re.sub(r"(?i)(version[-_ ]?)(?:3\.2\.0|2\.0\.0|2\.0)", rf"\g<1>{version}", text)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("version")
    args = parser.parse_args()
    if not SEMVER.fullmatch(args.version):
        raise SystemExit("ERROR: version must use X.Y.Z")
    update_json(ROOT / "package.json", args.version)
    update_json(ROOT / "package-lock.json", args.version, lock=True)
    replace_text(ROOT / "index.html", args.version)
    replace_text(ROOT / "README.md", args.version)
    print(f"OK version={args.version}")


if __name__ == "__main__":
    main()
