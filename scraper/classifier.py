"""関連判定・除外・分類。"""
from config import (
    SUNTORY_MARKERS, EXCLUSION_KEYWORDS, SEGMENT_KEYWORDS, TOPIC_KEYWORDS,
)


def _text(a):
    return (a.get("title", "") + " " + a.get("summary", "")).lower()


def is_suntory_related(a):
    t = _text(a)
    return any(m.lower() in t for m in SUNTORY_MARKERS)


def is_excluded(a):
    t = _text(a)
    return any(k.lower() in t for k in EXCLUSION_KEYWORDS)


def _match(a, table):
    t = _text(a)
    return [key for key, kws in table.items() if any(k.lower() in t for k in kws)]


def classify(a):
    """a に related / segments / topics を付与して返す。"""
    related = is_suntory_related(a)
    segments = _match(a, SEGMENT_KEYWORDS)
    if not related:
        # 業界ニュース（サントリー言及なし）は専用セグメントのみ
        segments = ["Industry"]
    elif not segments:
        segments = ["Other"]
    a["related"] = related
    a["segments"] = segments
    a["topics"] = _match(a, TOPIC_KEYWORDS)
    return a
