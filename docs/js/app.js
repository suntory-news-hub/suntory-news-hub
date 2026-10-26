// Suntory News Hub — 表示ロジック（news.json を読み込んで描画）
const PAGE = 60;

const SEGMENTS = {
  Wellness:  { label: '💚 ウエルネス',   color: 'var(--wellness)' },
  Beverage:  { label: '🥤 飲料・食品',   color: 'var(--beverage)' },
  Alcohol:   { label: '🍺 酒類',         color: 'var(--alcohol)' },
  Corporate: { label: '🏢 経営・HD',     color: 'var(--corporate)' },
  Society:   { label: '🌏 社会・文化',   color: 'var(--society)' },
  Other:     { label: '📰 その他',       color: 'var(--other)' },
  Industry:  { label: '🔬 健康食品業界', color: 'var(--industry)' },
};
const TOPICS = {
  Launch: '新商品', Ad: '広告・CM', Business: '業績・経営', Research: '研究', Regulation: '規制・行政',
};
const PERIODS = { 3: '3日', 7: '1週間', 30: '1か月', 0: 'すべて' };
const VIEWS = { all: 'すべて', fav: '⭐ お気に入り', memo: '📝 メモあり' };

const state = {
  articles: [], sort: 'wellness', segment: 'all', topic: 'all',
  period: '0', view: 'all', keyword: '', limit: PAGE,
};

// ---------- localStorage（使えない環境でも動くように） ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
const favs = () => store.get('snh_favs', []);
const memos = () => store.get('snh_memos', {});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 起動 ----------
async function init() {
  const saved = store.get('snh_prefs', {});
  if (saved.sort) state.sort = saved.sort;
  if (saved.period) state.period = saved.period;
  try {
    const res = await fetch('data/news.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.articles = data.articles || [];
    const d = new Date(data.lastUpdated);
    document.getElementById('updateMeta').textContent =
      `更新 ${d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}・${data.totalCount}件`;
  } catch (e) {
    document.getElementById('newsList').innerHTML =
      `<div class="empty">記事データを読み込めませんでした（${esc(e.message)}）</div>`;
    return;
  }
  buildChips();
  bind();
  render();
}

function countBy(key, values) {
  const c = {};
  state.articles.forEach((a) => (a[key] || []).forEach((v) => { c[v] = (c[v] || 0) + 1; }));
  return c;
}

function chip(group, value, label, active, count, extraClass = '') {
  const n = count != null ? `<span class="n">${count}</span>` : '';
  return `<button class="chip ${extraClass} ${active ? 'active' : ''}" data-group="${group}" data-value="${value}">${label}${n}</button>`;
}

function buildChips() {
  const segCount = countBy('segments');
  const related = state.articles.filter((a) => a.related).length;
  document.getElementById('segmentChips').innerHTML =
    chip('segment', 'all', 'サントリー全体', state.segment === 'all', related) +
    Object.entries(SEGMENTS).filter(([k]) => segCount[k])
      .map(([k, v]) => chip('segment', k, v.label, state.segment === k, segCount[k], 'seg-' + k)).join('');

  const topCount = countBy('topics');
  document.getElementById('topicChips').innerHTML =
    chip('topic', 'all', 'すべて', state.topic === 'all') +
    Object.entries(TOPICS).filter(([k]) => topCount[k])
      .map(([k, v]) => chip('topic', k, v, state.topic === k, topCount[k])).join('');

  document.getElementById('periodChips').innerHTML = Object.entries(PERIODS)
    .map(([k, v]) => chip('period', k, v, state.period === k)).join('');
  document.getElementById('viewChips').innerHTML = Object.entries(VIEWS)
    .map(([k, v]) => chip('view', k, v, state.view === k)).join('');

  document.querySelectorAll('.sort-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.sort === state.sort));
}

function bind() {
  document.body.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (c) {
      state[c.dataset.group] = c.dataset.value;
      afterChange();
      return;
    }
    const s = e.target.closest('.sort-btn');
    if (s) { state.sort = s.dataset.sort; afterChange(); return; }
    const act = e.target.closest('.act');
    if (act) handleAction(act.dataset.act, act.dataset.id);
  });
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.keyword = e.target.value.trim().toLowerCase();
    state.limit = PAGE;
    render();
  });
  document.getElementById('loadMoreBtn').addEventListener('click', () => {
    state.limit += PAGE; render();
  });
  document.getElementById('exportLink').addEventListener('click', (e) => { e.preventDefault(); exportMemos(); });
  document.getElementById('newsList').addEventListener('focusout', (e) => {
    if (e.target.matches('.memo textarea')) saveMemo(e.target.dataset.id, e.target.value);
  });
}

function afterChange() {
  state.limit = PAGE;
  store.set('snh_prefs', { sort: state.sort, period: state.period });
  buildChips();
  render();
}

// ---------- 絞り込み ----------
function filtered() {
  const f = new Set(favs());
  const m = memos();
  const since = state.period === '0' ? 0 : Date.now() - Number(state.period) * 864e5;
  return state.articles.filter((a) => {
    if (state.segment === 'all') { if (!a.related) return false; }
    else if (!a.segments.includes(state.segment)) return false;
    if (state.topic !== 'all' && !a.topics.includes(state.topic)) return false;
    if (since && new Date(a.publishedAt).getTime() < since) return false;
    if (state.view === 'fav' && !f.has(a.id)) return false;
    if (state.view === 'memo' && !m[a.id]) return false;
    if (state.keyword) {
      const t = (a.title + ' ' + a.summary + ' ' + a.source).toLowerCase();
      if (!t.includes(state.keyword)) return false;
    }
    return true;
  });
}

const isWellness = (a) => a.segments.includes('Wellness');

// ---------- 描画 ----------
function render() {
  const list = filtered();
  const shown = list.slice(0, state.limit);
  const wCount = list.filter(isWellness).length;
  document.getElementById('resultCount').textContent =
    `${list.length}件（うちウエルネス ${wCount}件）`;

  const el = document.getElementById('newsList');
  if (!list.length) {
    el.innerHTML = '<div class="empty">該当する記事がありません。期間を「すべて」にすると見つかるかもしれません。</div>';
    document.getElementById('loadMoreBtn').hidden = true;
    return;
  }

  let html = '';
  if (state.sort === 'wellness' && state.segment !== 'Wellness') {
    // ウエルネスは件数制限なしで先頭に、残りを新着順で
    const allW = list.filter(isWellness);
    const restAll = list.filter((a) => !isWellness(a)).slice(0, Math.max(0, state.limit - allW.length));
    if (allW.length) {
      html += `<div class="section-head wellness">💚 ウエルネス関連 <span class="n">${allW.length}件</span></div>`;
      html += withDays(allW, true);
    }
    if (restAll.length) {
      html += `<div class="section-head">サントリーその他のニュース</div>`;
      html += withDays(restAll, false);
    }
    el.innerHTML = html;
    document.getElementById('loadMoreBtn').hidden = allW.length + restAll.length >= list.length;
    return;
  }
  el.innerHTML = withDays(shown, false);
  document.getElementById('loadMoreBtn').hidden = shown.length >= list.length;
}

function dayLabel(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = Math.round((today - x) / 864e5);
  if (diff === 0) return '今日';
  if (diff === 1) return '昨日';
  return x.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}

function withDays(arr, highlight) {
  let last = '';
  return arr.map((a) => {
    const label = dayLabel(a.publishedAt);
    const head = label !== last ? `<div class="day-head">${label}</div>` : '';
    last = label;
    return head + card(a, highlight);
  }).join('');
}

function card(a, highlight) {
  const primary = a.segments[0] || 'Other';
  const segColor = (SEGMENTS[primary] || SEGMENTS.Other).color;
  const isFav = favs().includes(a.id);
  const memo = memos()[a.id] || '';
  const time = new Date(a.publishedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const segTags = a.segments.map((s) => SEGMENTS[s]
    ? `<span class="tag seg" style="--tagc:${SEGMENTS[s].color}">${SEGMENTS[s].label.replace(/^\S+\s/, '')}</span>` : '').join('');
  const topTags = a.topics.slice(0, 2).map((t) => `<span class="tag">${TOPICS[t]}</span>`).join('');
  const id = esc(a.id);
  return `
  <article class="card" style="--seg:${segColor}">
    <div class="card-meta"><span class="src">${esc(a.source)}</span><span>${time}</span>${segTags}${topTags}</div>
    <div class="card-title"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a></div>
    ${a.summary ? `<div class="card-sum">${esc(a.summary)}</div>` : ''}
    <div class="actions">
      <button class="act ${isFav ? 'on' : ''}" data-act="fav" data-id="${id}">${isFav ? '★ お気に入り' : '☆ お気に入り'}</button>
      <button class="act ${memo ? 'on' : ''}" data-act="memo" data-id="${id}">📝 ${memo ? 'メモあり' : 'メモ'}</button>
    </div>
    <div class="memo" id="memo-${id}">
      <textarea data-id="${id}" placeholder="提案ネタ・気づきなど（この端末のブラウザにだけ保存）">${esc(memo)}</textarea>
      <div class="memo-status" id="ms-${id}"></div>
    </div>
  </article>`;
}

function handleAction(act, id) {
  if (act === 'fav') {
    const f = favs();
    store.set('snh_favs', f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
    render();
  } else if (act === 'memo') {
    const box = document.getElementById('memo-' + id);
    box.classList.toggle('open');
    if (box.classList.contains('open')) box.querySelector('textarea').focus();
  }
}

function saveMemo(id, value) {
  const m = memos();
  if (value.trim()) m[id] = value; else delete m[id];
  store.set('snh_memos', m);
  const s = document.getElementById('ms-' + id);
  if (s) { s.textContent = '✓ 保存しました'; setTimeout(() => { s.textContent = ''; }, 1500); }
}

function exportMemos() {
  const m = memos();
  const items = state.articles.filter((a) => m[a.id]);
  if (!items.length) { alert('保存されているメモがありません'); return; }
  const md = `# Suntory News メモ（${new Date().toLocaleDateString('ja-JP')}）\n\n` + items.map((a) =>
    `## ${a.title}\n- 媒体: ${a.source}\n- 日付: ${new Date(a.publishedAt).toLocaleDateString('ja-JP')}\n- URL: ${a.url}\n- メモ: ${m[a.id]}\n`).join('\n');
  const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  const link = Object.assign(document.createElement('a'), {
    href: url, download: `suntory_news_memos_${new Date().toISOString().slice(0, 10)}.md`,
  });
  link.click();
  URL.revokeObjectURL(url);
}

init();
