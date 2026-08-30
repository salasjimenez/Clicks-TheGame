#!/usr/bin/env python3
"""Measure static payload and eager/lazy JavaScript bytes."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
JS = ASSETS / "js"


def size(paths: list[Path] | set[Path]) -> int:
    return sum(path.stat().st_size for path in paths if path.is_file())


def js_graph(entry: Path) -> tuple[set[Path], set[Path]]:
    eager: set[Path] = set()
    lazy: set[Path] = set()
    queue = [entry]
    while queue:
        path = queue.pop()
        if path in eager or not path.exists():
            continue
        eager.add(path)
        text = path.read_text(encoding="utf-8")
        for spec in re.findall(r"(?:from\s+|import\s*)['\"]([^'\"]+\.js)['\"]", text):
            resolved = (path.parent / spec).resolve()
            if resolved not in eager:
                queue.append(resolved)
        for spec in re.findall(r"import\(\s*['\"]([^'\"]+\.js)['\"]\s*\)", text):
            lazy.add((path.parent / spec).resolve())
    return eager, lazy


def report() -> dict[str, int]:
    all_assets = [path for path in ASSETS.rglob("*") if path.is_file()] if ASSETS.exists() else []
    entry = JS / "main.js"
    eager, lazy = js_graph(entry) if entry.exists() else (set(), set())
    return {
        "total_static_bytes": size(all_assets) + ((ROOT / "index.html").stat().st_size if (ROOT / "index.html").exists() else 0),
        "all_js_bytes": size(set(JS.rglob("*.js"))) if JS.exists() else 0,
        "eager_js_bytes": size(eager),
        "lazy_js_bytes": size(lazy),
        "eager_modules": len(eager),
        "lazy_modules": len(lazy),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()
    current = report()
    print(json.dumps(current, indent=2))
    if args.write:
        args.write.parent.mkdir(parents=True, exist_ok=True)
        args.write.write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")
    if args.baseline and args.baseline.exists():
        baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
        print("delta:")
        for key in ("total_static_bytes", "all_js_bytes", "eager_js_bytes", "lazy_js_bytes"):
            before = int(baseline.get(key, 0))
            after = int(current.get(key, 0))
            delta = after - before
            pct = (delta / before * 100) if before else 0.0
            print(f"  {key}: {before} -> {after} ({delta:+d}, {pct:+.1f}%)")


if __name__ == "__main__":
    main()
