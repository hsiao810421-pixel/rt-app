/* 中榮 RT 隨身站 — Phase 2 儀表板 */
'use strict';

const DEFAULT_GROUPS = ['總組長', '教學', '儀器', '品管', '資訊', '兒醫'];
const state = { config: null };

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, html) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return iso;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return iso; }
};
const isMobile = () => window.innerWidth < 768;
async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(path + ' ' + res.status);
  return res.json();
}
async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(url + ' ' + res.status);
  return res.text();
}
function parseCSV(text) {
  const rows = []; let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
    i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------- data ---------- */
async function ensureData() {
  if (!state.config) state.config = await loadJSON('data/config.json');
  return state.config;
}

/* ---------- view frame ---------- */
const view = $('#view');
function render(nodes) {
  view.innerHTML = '';
  const wrap = el('div', { class: 'fade-in' });
  (Array.isArray(nodes) ? nodes : [nodes]).forEach(n => n && wrap.appendChild(n));
  view.appendChild(wrap);
}

function panel(area, title, opts = {}) {
  const sec = el('section', { class: 'panel panel--' + area });
  const head = el('div', { class: 'panel__head' });
  head.appendChild(el('div', { class: 'panel__title' }, title));
  if (opts.actionHref) {
    const a = el('a', { class: 'panel__action', href: opts.actionHref });
    if (opts.external !== false) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    a.innerHTML = (opts.actionLabel || '開啟') + ' ↗';
    head.appendChild(a);
  }
  sec.appendChild(head);
  const body = el('div', { class: 'panel__body' + (opts.scroll ? ' panel__body--scroll' : '') });
  sec.appendChild(body);
  sec._body = body;
  return sec;
}
function placeholder(msg) { return el('div', { class: 'ph' }, msg); }

/* ---------- panels ---------- */
function panelAttend(cfg) {
  const url = cfg.links.scheduleApp;
  const p = panel('attend', '📋 今日出勤', { actionLabel: '進入班表', actionHref: url || undefined });
  if (url) {
    p._body.appendChild(el('iframe', { class: 'frame', src: url, loading: 'lazy', title: '班表系統' }));
  } else {
    p._body.appendChild(placeholder('尚未設定班表系統網址'));
  }
  return p;
}

function calendarSrc(url) {
  try {
    const u = new URL(url);
    u.searchParams.set('mode', isMobile() ? 'AGENDA' : 'MONTH');
    return u.toString();
  } catch { return url; }
}
function panelCalendar(cfg) {
  const p = panel('calendar', '🗓️ 行事曆');
  if (cfg.calendarEmbedUrl) {
    p._body.appendChild(el('iframe', { class: 'frame', src: calendarSrc(cfg.calendarEmbedUrl), loading: 'lazy', title: 'Google 日曆', frameborder: '0' }));
  } else {
    p._body.appendChild(placeholder('尚未設定 Google 日曆內嵌網址<br><span class="ph-sub">（設定 → 整合日曆 → 內嵌程式碼）</span>'));
  }
  return p;
}

async function loadAnnouncements(cfg) {
  if (cfg.announcementsCsvUrl) {
    try {
      const txt = await fetchText(cfg.announcementsCsvUrl);
      const rows = parseCSV(txt).filter(r => r.some(c => (c || '').trim() !== ''));
      if (rows.length) {
        const head = rows.shift().map(h => (h || '').trim());
        const idx = (name) => head.findIndex(h => h.includes(name));
        const gi = idx('組'), di = idx('日期'), ti = idx('時間'), ci = idx('內容');
        const items = rows.map(r => ({
          group: (r[gi] || '').trim(), date: (r[di] || '').trim(),
          time: (r[ti] || '').trim(), content: (r[ci] || '').trim(),
        })).filter(x => x.content);
        return { items, groups: DEFAULT_GROUPS, sample: false };
      }
    } catch (e) { console.warn('公告 CSV 讀取失敗，改用範例', e); }
  }
  return loadJSON('data/announcements-groups.json').catch(() => ({ items: [], groups: DEFAULT_GROUPS, sample: true }));
}

async function panelAnnounce(cfg) {
  const p = panel('announce', '📢 各組公告', { scroll: true });
  const data = await loadAnnouncements(cfg);
  if (data.sample) p.querySelector('.panel__title').appendChild(el('span', { class: 'tag-sample' }, '範例'));
  const groups = (data.groups && data.groups.length) ? data.groups : DEFAULT_GROUPS;
  const byGroup = {};
  (data.items || []).forEach(it => { (byGroup[it.group] = byGroup[it.group] || []).push(it); });

  let any = false;
  groups.forEach(g => {
    const list = (byGroup[g] || []).slice().sort((a, b) => (b.date > a.date ? 1 : -1));
    const block = el('div', { class: 'ann-group' });
    block.appendChild(el('div', { class: 'ann-group__head' }, esc(g)));
    if (!list.length) {
      block.appendChild(el('div', { class: 'ann-empty' }, '目前無公告'));
    } else {
      any = true;
      list.forEach(it => {
        const item = el('div', { class: 'ann-item' });
        const meta = [fmtDate(it.date), it.time].filter(Boolean).join(' ');
        if (meta) item.appendChild(el('div', { class: 'ann-item__meta' }, esc(meta)));
        item.appendChild(el('div', { class: 'ann-item__content' }, esc(it.content)));
        block.appendChild(item);
      });
    }
    p._body.appendChild(block);
  });
  return p;
}

async function loadVent(cfg) {
  if (cfg.ventJsonUrl) {
    try { const r = await fetch(cfg.ventJsonUrl, { cache: 'no-cache' }); if (r.ok) return r.json(); }
    catch (e) { console.warn('呼吸器 JSON 讀取失敗，改用範例', e); }
  }
  return loadJSON('data/vent.json').catch(() => ({ types: [], sample: true }));
}

async function panelVent(cfg) {
  const p = panel('vent', '🫁 每日呼吸器剩餘數量', { actionLabel: '詳細', actionHref: cfg.links.ventilator || undefined });
  const data = await loadVent(cfg);
  if (data.sample) p.querySelector('.panel__title').appendChild(el('span', { class: 'tag-sample' }, '範例'));
  if (data.date) p.querySelector('.panel__head').insertBefore(el('span', { class: 'panel__date' }, fmtDate(data.date)), p.querySelector('.panel__action'));

  const grid = el('div', { class: 'vent-grid' });
  (data.types || []).forEach(t => {
    const low = (t.safe != null) && (t.remaining < t.safe);
    const tile = el('div', { class: 'vent-tile' + (low ? ' vent-tile--low' : '') });
    tile.appendChild(el('div', { class: 'vent-tile__name' }, esc(t.name)));
    tile.appendChild(el('div', { class: 'vent-tile__num' }, `${esc(t.remaining)}<span class="u">${esc(t.unit || '台')}</span>`));
    tile.appendChild(el('div', { class: 'vent-tile__safe' }, t.safe != null ? `安全 ≥ ${esc(t.safe)}` : '無閾值'));
    if (low) tile.appendChild(el('div', { class: 'vent-tile__warn' }, '⚠ 低於安全值'));
    grid.appendChild(tile);
  });
  if (!(data.types || []).length) p._body.appendChild(placeholder('尚無資料'));
  else p._body.appendChild(grid);
  return p;
}

function panelDb(cfg) {
  const url = cfg.links.rtDatabase;
  const p = panel('db', '📚 RT 資料庫', { actionLabel: '開啟', actionHref: url || undefined });
  p._body.appendChild(url
    ? el('a', { class: 'big-link', href: url, target: '_blank', rel: 'noopener' }, '開啟 Google Drive 資料庫 ↗')
    : placeholder('建置中…（Google Drive 連結待補）'));
  return p;
}

function panelGuides(cfg) {
  const p = panel('guides', '📖 守則與指引');
  const items = [
    { t: 'RT 常規工作守則', u: cfg.links.guideDoc, ico: '📗' },
    { t: '業務快速指引', u: cfg.links.businessGuideDoc, ico: '📕' },
  ];
  let n = 0;
  items.forEach(it => {
    if (!it.u) return;
    n++;
    const a = el('a', { class: 'link-row', href: it.u, target: '_blank', rel: 'noopener' });
    a.innerHTML = `<span class="link-row__ico">${it.ico}</span><span class="link-row__t">${esc(it.t)}</span><span class="link-row__chev">↗</span>`;
    p._body.appendChild(a);
  });
  if (!n) p._body.appendChild(placeholder('連結待補'));
  return p;
}

async function panelKnowledge(cfg) {
  const p = panel('knowledge', '💡 新知識');
  const kn = await loadJSON('data/knowledge.json').catch(() => ({ items: [] }));
  const items = (kn.items || []).slice(0, 4);
  if (!items.length) { p._body.appendChild(placeholder('先保留，尚無內容')); return p; }
  items.forEach(it => {
    const tag = it.link ? 'a' : 'div';
    const c = el(tag, { class: 'kn-item' });
    if (it.link) { c.setAttribute('href', it.link); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
    c.appendChild(el('div', { class: 'kn-item__head' }, `<span class="pill">${esc(it.tag || '新知')}</span><span class="kn-item__date">${fmtDate(it.date)}</span>`));
    c.appendChild(el('div', { class: 'kn-item__title' }, esc(it.title)));
    p._body.appendChild(c);
  });
  return p;
}

async function viewDashboard() {
  const cfg = await ensureData();
  const dash = el('div', { class: 'dash' });
  dash.appendChild(panelAttend(cfg));
  dash.appendChild(panelCalendar(cfg));
  dash.appendChild(await panelAnnounce(cfg));
  dash.appendChild(await panelVent(cfg));
  dash.appendChild(panelDb(cfg));
  dash.appendChild(panelGuides(cfg));
  dash.appendChild(await panelKnowledge(cfg));
  render(dash);
}

/* ---------- other tabs ---------- */
function linkCard({ ico, title, sub, href, external = true }) {
  const c = el('a', { class: 'card', href });
  if (external) { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
  const row = el('div', { class: 'card__row' });
  row.appendChild(el('div', { class: 'card__ico' }, ico));
  row.appendChild(el('div', { class: 'card__body' }, `<div class="card__title">${esc(title)}</div><div class="card__sub">${esc(sub)}</div>`));
  row.appendChild(el('div', { class: 'card__chev' }, '›'));
  c.appendChild(row);
  return c;
}

async function viewVent() {
  const cfg = await ensureData();
  const url = cfg.links.ventilator;
  const nodes = [el('div', { class: 'section-title' }, '🫁 呼吸器數量')];
  nodes.push(url
    ? linkCard({ ico: '📊', title: '每日呼吸器儀表板', sub: '即時台數、警示、歷史趨勢（開啟）', href: url })
    : el('div', { class: 'card' }, '<div class="empty">尚未設定儀表板網址</div>'));
  nodes.push(el('div', { class: 'muted-note' }, '資料每 10 分鐘更新。低於安全閾值會自動示警。'));
  render(nodes);
}

async function viewGuide() {
  const cfg = await ensureData();
  const nodes = [el('div', { class: 'section-title' }, '📘 工作守則與指引')];
  const guideUrl = cfg.links.guideWebsite || cfg.links.guideDoc;
  nodes.push(guideUrl
    ? linkCard({ ico: '📗', title: 'RT 常規工作守則', sub: cfg.links.guideWebsite ? '可檢索網頁版（開啟）' : 'Google 文件（開啟）', href: guideUrl })
    : el('div', { class: 'card' }, '<div class="card__row"><div class="card__ico">📗</div><div class="card__body"><div class="card__title">RT 常規工作守則</div><div class="card__sub">連結待補</div></div></div>'));
  if (cfg.links.businessGuideDoc)
    nodes.push(linkCard({ ico: '📕', title: '業務快速指引', sub: '流程圖與 SOP（Google 文件，開啟）', href: cfg.links.businessGuideDoc }));
  render(nodes);
}

async function viewSchedule() {
  const cfg = await ensureData();
  const url = cfg.links.scheduleApp;
  const nodes = [el('div', { class: 'section-title-row' },
    '<span class="section-title" style="margin:0">📅 班表系統</span>')];
  if (url) {
    const a = el('a', { class: 'panel__action', href: url, target: '_blank', rel: 'noopener' }, '開新視窗 ↗');
    nodes[0].appendChild(a);
    const frame = el('iframe', { class: 'frame frame--full', src: url, title: '班表系統', loading: 'lazy' });
    nodes.push(frame);
  } else {
    nodes.push(el('div', { class: 'card' }, '<div class="empty">尚未設定班表系統網址</div>'));
  }
  render(nodes);
}

async function viewMore() {
  const cfg = await ensureData();
  const nodes = [el('div', { class: 'section-title' }, '更多功能')];
  nodes.push(cfg.links.lineBot
    ? linkCard({ ico: '💬', title: 'RT LINE 問答機器人', sub: 'AI 依科內文件回答（加好友）', href: cfg.links.lineBot })
    : el('div', { class: 'card' }, '<div class="card__row"><div class="card__ico">💬</div><div class="card__body"><div class="card__title">RT LINE 問答機器人</div><div class="card__sub">加好友連結待補</div></div></div>'));
  if (cfg.links.rtDatabase)
    nodes.push(linkCard({ ico: '📚', title: 'RT 資料庫', sub: 'Google Drive 文件（開啟）', href: cfg.links.rtDatabase }));

  nodes.push(el('div', { class: 'section-title' }, '通知'));
  nodes.push(el('div', { class: 'card' }, '<div class="card__row"><div class="card__ico">🔔</div><div class="card__body"><div class="card__title">推播通知</div><div class="card__sub">公告更新時通知我（Phase 3 開通）</div></div></div>'));

  nodes.push(el('div', { class: 'section-title' }, '關於'));
  nodes.push(el('div', { class: 'card' },
    `<div class="card__title">${esc(cfg.appName)}</div><div class="card__sub">${esc(cfg.org)}　版本 ${esc(cfg.version)}</div>`));
  nodes.push(el('div', { class: 'muted-note' }, '在瀏覽器選單選「加到主畫面」即可安裝成 App。'));
  render(nodes);
}

/* ---------- router ---------- */
const routes = { home: viewDashboard, vent: viewVent, guide: viewGuide, schedule: viewSchedule, more: viewMore };
async function route() {
  const hash = (location.hash || '#/home').replace('#/', '');
  const name = routes[hash] ? hash : 'home';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
  window.scrollTo(0, 0);
  view.innerHTML = '<div class="loading">載入中…</div>';
  try { await routes[name](); }
  catch (e) {
    if (location.protocol === 'file:') {
      render(el('div', { class: 'empty' },
        '⚠️ 請不要直接雙擊 index.html 開啟。<br><br>請改用資料夾裡的<br><b>「啟動RT隨身站.bat」</b><br>來開啟本機預覽。<br><br>' +
        '<span style="font-size:12px">（瀏覽器在 file:// 下會封鎖讀取資料檔，正式版放到網站上就正常。）</span>'));
    } else {
      render(el('div', { class: 'empty' }, '載入失敗：' + esc(e.message)));
    }
  }
}
window.addEventListener('hashchange', route);

/* ---------- install prompt ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  const b = $('#installBtn'); if (b) b.hidden = false;
});
$('#installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; $('#installBtn').hidden = true;
});

/* ---------- boot ---------- */
(async function boot() {
  try {
    const cfg = await ensureData();
    $('#brandName').textContent = cfg.appShortName || cfg.appName;
    $('#brandOrg').textContent = cfg.org || '';
    document.title = cfg.appName;
  } catch (_) {}
  await route();
  if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('sw.js'); } catch (_) {} }
})();
