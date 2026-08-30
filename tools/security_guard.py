#!/usr/bin/env python3
"""Fail CI if phishing-like, unsafe, or removed UI patterns reappear."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ROOTS = [ROOT / "index.html", ROOT / "src", ROOT / "assets" / "js"]
PATTERNS = {
    "external identity gate": re.compile(r"github-username|verify-star|open-star-gate|hasStarredRepository|updateGitHubStars|api\.github\.com", re.I),
    "repo coercion CTA": re.compile(r"star\s+repository|github-star-gate|github-star-count|(?:dale|dame|deja|dar).{0,24}estrella|(?:s[ií]gueme|ap[oó]yame).{0,24}(?:github|repo|repositorio)?", re.I),
    "fake verification/captcha wording": re.compile(r"verify.{0,24}(human|identity)|captcha", re.I),
    "system command lure": re.compile(r"powershell|cmd\.exe|mshta|wscript|cscript", re.I),
    "dynamic code execution": re.compile(r"\beval\s*\(|\bnew\s+Function\s*\(|document\.write\s*\(|\batob\s*\(", re.I),
    "iframe": re.compile(r"<iframe\b", re.I),
    "removed theme control": re.compile(r"theme-toggle", re.I),
    "removed achievement feed": re.compile(r"ACHIEVEMENT_FEED|achievement-terminal-preview", re.I),
}


def files() -> list[Path]:
    result: list[Path] = []
    for item in RUNTIME_ROOTS:
        if item.is_file():
            result.append(item)
        elif item.is_dir():
            result.extend(path for path in item.rglob("*") if path.suffix.lower() in {".ts", ".js", ".html"})
    return sorted(set(result))


violations: list[str] = []
for path in files():
    text = path.read_text(encoding="utf-8", errors="replace")
    for label, pattern in PATTERNS.items():
        match = pattern.search(text)
        if match:
            line = text.count("\n", 0, match.start()) + 1
            violations.append(f"{path.relative_to(ROOT)}:{line}: {label}: {match.group(0)!r}")

index = ROOT / "index.html"
if index.exists():
    text = index.read_text(encoding="utf-8", errors="replace")
    github_hrefs = re.findall(r'href=["\'](https://github\.com/[^"\']+)["\']', text, flags=re.I)
    expected = "https://github.com/sjhonn/Clicks-TheGame"
    for href in github_hrefs:
        if href.rstrip("/") != expected:
            violations.append(f"index.html: unapproved GitHub destination: {href}")
    if len(github_hrefs) > 1:
        violations.append("index.html: more than one GitHub link is present")

workflow = ROOT / ".github" / "workflows" / "pages.yml"
if workflow.exists():
    for line_number, line in enumerate(workflow.read_text(encoding="utf-8").splitlines(), 1):
        if "uses:" not in line:
            continue
        ref = line.split("@", 1)[1].split()[0] if "@" in line else ""
        if not re.fullmatch(r"[0-9a-f]{40}", ref):
            violations.append(f"{workflow.relative_to(ROOT)}:{line_number}: action is not pinned to a full SHA")

if violations:
    print("SECURITY_GUARD=FAIL", file=sys.stderr)
    print("\n".join(violations), file=sys.stderr)
    raise SystemExit(1)
print(f"SECURITY_GUARD=PASS files={len(files())}")
