"""RSS取得・パース。fetch_rss(source) で共通フォーマットの記事リストを返す。"""
import hashlib
import re
from html import unescape

import feedparser

from config import MAX_PER_SOURCE

_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")
# ウォーカープラス等の「＜画像1 / 8＞」「画像1 / 8＞」プレフィックス
_GALLERY_RE = re.compile(r"^\s*[＜<]?画像\s*\d+\s*/\s*\d+\s*\s*[＞>]\s*")


def _strip_html(text):
    if not text:
        return ""
    text = unescape(_TAG_RE.sub(" ", text))
    return _SPACE_RE.sub(" ", text).strip()


def _split_gnews_title(title):
    """Google Newsのタイトル末尾「 - 媒体名」を分離。"""
    if " - " in title:
        body, src = title.rsplit(" - ", 1)
        return body.strip(), src.strip()
    return title, "Google News"


def make_id(url):
    return "n_" + hashlib.md5(url.encode("utf-8")).hexdigest()[:12]


def fetch_rss(source):
    feed = feedparser.parse(source["url"])
    articles = []
    for entry in feed.entries[:MAX_PER_SOURCE]:
        raw_title = entry.get("title", "").strip()
        url = entry.get("link", "").strip()
        if not raw_title or not url:
            continue

        title, media = _split_gnews_title(raw_title)
        title = _GALLERY_RE.sub("", title)
        if isinstance(entry.get("source"), dict) and entry["source"].get("title"):
            media = entry["source"]["title"]

        # Google Newsのsummaryはタイトルの繰り返しなので、別内容のときだけ残す
        summary = _GALLERY_RE.sub("", _strip_html(entry.get("summary", "")))
        if title[:15] in summary or len(summary) < 10:
            summary = ""

        articles.append({
            "id": make_id(url),
            "title": title,
            "url": url,
            "source": media,
            "query": source["name"],
            "scope": source["scope"],
            "publishedAt": entry.get("published", "") or entry.get("updated", ""),
            "summary": summary[:160],
        })
    return articles
