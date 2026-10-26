# Suntory News Hub

サントリーグループ関連のニュース（主に日本国内）を毎朝自動で集めて一覧表示する、非公式のまとめサイトです。

- 取得元：Google News RSS（日本語・日本向け）
- 更新：毎朝 6:47（日本時間）に GitHub Actions が自動実行
- 表示：見出し・媒体名・日付・元記事リンクのみ（本文は転載しない）
- 保持：過去180日分を蓄積

## 画面でできること

- **💚 ウエルネス優先 / 🕒 新着順** の切り替え（ワンタップ）
- 事業別フィルタ：ウエルネス／飲料・食品／酒類／経営・HD／社会・文化／その他／健康食品業界
- トピック別フィルタ：新商品／広告・CM／業績・経営／研究／規制・行政
- 期間（3日／1週間／1か月／すべて）とキーワード検索
- お気に入り・メモ（閲覧している端末のブラウザにだけ保存）とメモのMarkdown書き出し

## カスタマイズ

取得キーワード・除外ワード・分類辞書はすべて `scraper/config.py` にあります。

| やりたいこと | 編集する場所 |
|---|---|
| 追う記事を増やす | `SOURCES` に Google News の検索語を追加 |
| ノイズを消す | `EXCLUSION_KEYWORDS` に語を追加 |
| 分類を直す | `SEGMENT_KEYWORDS` / `TOPIC_KEYWORDS` |

## 構成

```
scraper/   Python（取得・除外・分類・アーカイブ統合）
docs/      公開サイト（GitHub Pages の公開元）
  data/news.json  毎朝更新される記事データ
.github/workflows/update-news.yml  毎朝の自動実行
```

ローカルで動かす場合：`pip install -r scraper/requirements.txt && python scraper/main.py`
