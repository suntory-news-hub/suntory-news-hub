"""Suntory News Hub - スクレイパー本体

全ソース取得 → 関連判定・除外 → 既存アーカイブと統合 → 重複排除 → 分類 →
docs/data/news.json に書き出し。

実行: python scraper/main.py
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from config import SOURCES, KEEP_DAYS, MAX_ARTICLES  # noqa: E402
from fetcher import fetch_rss  # noqa: E402
from classifier import is_suntory_related, is_excluded, classify  # noqa: E402

_OUT = os.path.join(_HERE, "..", "docs", "data", "news.json")
_MIN = datetime.min.replace(tzinfo=timezone.utc)


def parse_date(s):
    if not s:
        return _MIN
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s)
        except ValueError:
            return _MIN
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def title_key(title):
    """媒体違いの同一記事をまとめるための正規化タイトル。"""
    return re.sub(r"[\s　「」『』【】（）()<>＜＞｜|!！?？・、。,.:：\-－~〜…\"'”“]", "", title)[:40]


def load_existing():
    try:
        with open(_OUT, encoding="utf-8") as f:
            return json.load(f).get("articles", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def main():
    print("=== Suntory News Hub - Scraper ===")
    fresh, excluded, unrelated = [], 0, 0
    for src in SOURCES:
        try:
            items = fetch_rss(src)
        except Exception as e:  # 1ソースの失敗で全体を止めない
            print(f"  {src['name']}: ERROR {e}")
            continue
        kept = 0
        for a in items:
            if is_excluded(a):
                excluded += 1
                continue
            if src["scope"] == "suntory" and not is_suntory_related(a):
                unrelated += 1
                continue
            fresh.append(a)
            kept += 1
        print(f"  {src['name']}: {len(items)}件取得 / {kept}件採用")

    # 新着を優先して既存アーカイブと統合（既存の除外ルール変更も反映させる）
    archive = [a for a in load_existing() if not is_excluded(a)]
    merged, seen_url, seen_title = [], set(), set()
    for a in fresh + archive:
        tk = title_key(a["title"])
        if a["url"] in seen_url or tk in seen_title:
            continue
        seen_url.add(a["url"])
        seen_title.add(tk)
        merged.append(classify(a))

    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    merged = [a for a in merged if parse_date(a["publishedAt"]) >= cutoff]
    for a in merged:  # フロントで扱いやすいようISO形式に揃える
        d = parse_date(a["publishedAt"])
        if d != _MIN:
            a["publishedAt"] = d.isoformat()
    merged.sort(key=lambda a: parse_date(a["publishedAt"]), reverse=True)
    merged = merged[:MAX_ARTICLES]

    output = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "totalCount": len(merged),
        "stats": {"fetched": len(fresh), "excluded": excluded, "unrelated": unrelated},
        "articles": merged,
    }
    os.makedirs(os.path.dirname(_OUT), exist_ok=True)
    with open(_OUT, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=1)
    print(f"=== 完了: 保持 {len(merged)}件（今回採用 {len(fresh)} / 除外 {excluded} / 無関係 {unrelated}）===")


if __name__ == "__main__":
    main()
