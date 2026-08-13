#!/usr/bin/env python3
"""tax-invoice 소스를 하나의 HTML 파일로 합친다."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
INDEX = ROOT / "index.html"
SAMPLE = ROOT / "sample-data.js"
APP = ROOT / "app.js"
OUTS = [
    REPO / "세금계산서_미처리현황.html",
    ROOT / "세금계산서_미처리현황.html",
]


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    sample = SAMPLE.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    bundled = (
        '  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>\n'
        "  <script>\n"
        f"{sample}\n"
        f"{app}\n"
        "  </script>\n"
    )
    old = (
        '  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>\n'
        '  <script src="./sample-data.js"></script>\n'
        '  <script src="./app.js"></script>\n'
    )
    if old not in html:
        raise SystemExit("index.html script block not found")
    html = html.replace(old, bundled)
    for path in OUTS:
        path.write_text(html, encoding="utf-8")
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
