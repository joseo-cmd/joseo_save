#!/usr/bin/env python3
"""샘플 데이터의 예상담당자 판정이 규칙과 맞는지 검증한다."""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_sample import EMAIL_OWNERS, HISTORY, UNPROCESSED  # noqa: E402

EMAIL_OWNERS = {
    **EMAIL_OWNERS,
    "tatec@atecomputer.kr": "강소라(공공,수도권)",
}


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def norm_name(value: str) -> str:
    return re.sub(r"\(주\)|주식회사|\(유\)|유한회사|\s+", "", value or "").lower()


def emails(value: str) -> list[str]:
    return [p.strip().lower() for p in re.split(r"[;,\n|/]+", value or "") if p.strip()]


def counterpart(row: dict) -> tuple[str, str]:
    if row["구분"] == "매출":
        return row["공급받는자등록번호"], row["공급받는자상호"]
    return row["공급자등록번호"], row["공급자상호"]


def lookup_email(row: dict) -> str:
    if row["구분"] == "매입":
        return row.get("공급받는자이메일") or ""
    return row.get("공급자이메일") or ""


def pick_history(records: list[dict]) -> dict | None:
    if not records:
        return None
    tally: dict[str, dict] = {}
    for rec in records:
        owner = rec["처리담당자"]
        cur = tally.setdefault(owner, {"owner": owner, "count": 0, "latest": ""})
        cur["count"] += 1
        date = rec.get("처리일자") or ""
        if date >= cur["latest"]:
            cur["latest"] = date
    return max(tally.values(), key=lambda x: (x["count"], x["latest"]))


def assign(row: dict, by_biz: dict, by_name: dict) -> tuple[str, int]:
    email_field = lookup_email(row)
    for mail in emails(email_field):
        if mail in EMAIL_OWNERS:
            return EMAIL_OWNERS[mail], 1
    biz, name = counterpart(row)
    recs = by_biz.get(digits(biz)) or by_name.get(norm_name(name)) or []
    hit = pick_history(recs)
    if hit:
        return hit["owner"], 2
    return "미지정", 0


def main() -> int:
    by_biz = defaultdict(list)
    by_name = defaultdict(list)
    for rec in HISTORY:
        by_biz[digits(rec["거래처사업자번호"])].append(rec)
        by_name[norm_name(rec["거래처명"])].append(rec)

    expected = {
        "전남정보통신(주)": ("남부,중부사업부", 1),
        "대전스마트스쿨": ("남부,중부사업부", 1),
        "서울특별시교육청": ("이은정(교육,전자칠판)", 1),
        "강남구청 평생학습관": ("이은정(교육,전자칠판)", 1),
        "경기도청": ("강소라(공공,수도권)", 1),
        "인천광역시교육청": ("강소라(공공,수도권)", 1),
        "한빛시스템": None,  # 매출 2순위 박준호 / 매입 1순위 강소라
        "(주)블루웨이브": ("최민아", 2),
        "새봄커머스": ("미지정", 0),
        "호남전선자재": ("남부,중부사업부", 1),
        "충청로지스": ("남부,중부사업부", 1),
        "에듀보드코리아": ("이은정(교육,전자칠판)", 1),
        "러닝팩토리": ("이은정(교육,전자칠판)", 1),
        "수도권전산서비스": ("강소라(공공,수도권)", 1),
        "동아부품": ("남부,중부사업부", 2),
        "주식회사 그린로지스": ("강소라(공공,수도권)", 2),
        "북극성솔루션": ("미지정", 0),
    }

    failed = 0
    ranks = {1: 0, 2: 0, 0: 0}
    for row in UNPROCESSED:
        _, name = counterpart(row)
        owner, rank = assign(row, by_biz, by_name)
        ranks[rank] += 1
        if name == "한빛시스템":
            want = ("강소라(공공,수도권)", 1) if row["구분"] == "매입" else ("박준호", 2)
        else:
            want = expected[name]
        if (owner, rank) != want:
            print(f"FAIL {row['구분']} {name}: got {(owner, rank)} want {want}")
            failed += 1
        else:
            print(f"OK   {row['구분']} {name}: {owner} / {rank}순위")

    print(f"\nranks 1={ranks[1]} 2={ranks[2]} unset={ranks[0]} total={len(UNPROCESSED)}")
    if ranks != {1: 12, 2: 4, 0: 2}:
        print("FAIL rank totals")
        failed += 1
    if failed:
        print(f"\n{failed} failed")
        return 1
    print("\nall assertions passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
