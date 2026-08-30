#!/usr/bin/env python3
"""Validate IDs used by CLICK! data and source files. Python 3.11+ stdlib only."""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        raise SystemExit(f"ERROR: missing {relative}")
    return path.read_text(encoding="utf-8")


def duplicates(values: list[str]) -> list[str]:
    counts = Counter(values)
    return sorted(value for value, count in counts.items() if count > 1)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


achievements_text = read("src/data/achievements.ts")
achievement_ids = re.findall(r'["\']id["\']\s*:\s*["\']([A-Z][A-Z0-9_]+)["\']', achievements_text)
if len(achievement_ids) < 125:
    fail(f"expected at least 125 achievements, found {len(achievement_ids)}")
if dup := duplicates(achievement_ids):
    fail(f"duplicate achievement IDs: {', '.join(dup)}")

store_text = read("src/data/store.ts")
upgrade_section = store_text.split("export const CONSUMABLES", 1)[0]
upgrade_ids = re.findall(r"\bid\s*:\s*'([a-zA-Z][a-zA-Z0-9]+)'", upgrade_section)
if dup := duplicates(upgrade_ids):
    fail(f"duplicate upgrade IDs: {', '.join(dup)}")

deep_text = read("src/data/deep-prestige.ts")
deep_ids = re.findall(r"\bid\s*:\s*'([a-zA-Z][a-zA-Z0-9]+)'", deep_text)
if dup := duplicates(deep_ids):
    fail(f"duplicate deep upgrade IDs: {', '.join(dup)}")

types_text = read("src/types.ts")
upgrade_type_block = re.search(r"export type UpgradeId\s*=([\s\S]*?);", types_text)
deep_type_block = re.search(r"export type DeepUpgradeId\s*=([\s\S]*?);", types_text)
if not upgrade_type_block or not deep_type_block:
    fail("UpgradeId or DeepUpgradeId type not found")
upgrade_type_ids = re.findall(r"'([^']+)'", upgrade_type_block.group(1))
deep_type_ids = re.findall(r"'([^']+)'", deep_type_block.group(1))
if set(upgrade_ids) != set(upgrade_type_ids):
    fail(f"UpgradeId mismatch: definitions={sorted(upgrade_ids)} types={sorted(upgrade_type_ids)}")
if set(deep_ids) != set(deep_type_ids):
    fail(f"DeepUpgradeId mismatch: definitions={sorted(deep_ids)} types={sorted(deep_type_ids)}")

source_text = "\n".join(path.read_text(encoding="utf-8") for path in (ROOT / "src").rglob("*.ts"))

index_text = read("index.html")
dom_ids = re.findall(r"\bid=[\"\']([^\"\']+)[\"\']", index_text)
if dup := duplicates(dom_ids):
    fail(f"duplicate DOM IDs in index.html: {', '.join(dup)}")
static_by_id_refs = set(re.findall(r"\bbyId(?:<[^>]+>)?\(\s*[\"\']([^\"\']+)[\"\']", source_text))
missing_dom_ids = sorted(static_by_id_refs.difference(dom_ids))
if missing_dom_ids:
    fail(f"static byId references missing from index.html: {', '.join(missing_dom_ids)}")
for reference in re.findall(r"(?<!deepPrestige\.)upgrades\.([a-zA-Z][a-zA-Z0-9]+)", source_text):
    if reference not in upgrade_ids:
        fail(f"unknown base upgrade reference: {reference}")
for reference in re.findall(r"deepPrestige\.upgrades\.([a-zA-Z][a-zA-Z0-9]+)", source_text):
    if reference not in deep_ids:
        fail(f"unknown deep upgrade reference: {reference}")

engine_text = read("src/game/engine.ts")
explicit_achievement_refs = set(re.findall(r"(?:unlockAchievementById\(|id\s*===\s*)['\"]([A-Z][A-Z0-9_]+)['\"]", engine_text))
missing = sorted(explicit_achievement_refs.difference(achievement_ids))
if missing:
    fail(f"achievement references not defined: {', '.join(missing)}")

print(f"OK achievements={len(achievement_ids)} upgrades={len(upgrade_ids)} deep_upgrades={len(deep_ids)}")
