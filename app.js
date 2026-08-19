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

/* 細線 SVG icon（stroke=currentColor，取代 emoji） */
const ICONS = {
  attend: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  announce: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  vent: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  db: '<path d="M3 7.5a2 2 0 0 1 2-2h3.5l2 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  guides: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  knowledge: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M8.5 14c-1.5-1.2-2.5-3-2.5-5a6 6 0 0 1 12 0c0 2-1 3.8-2.5 5-.7.6-1 1.3-1 2.2H9.5c0-.9-.3-1.6-1-2.2z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7"/><path d="M3 20h18"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8 9 9 0 0 1-4-1L3 20l1.5-4.5A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};
const svgIcon = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
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
  if (opts.icon) head.appendChild(el('span', { class: 'panel__ico' }, svgIcon(opts.icon)));
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
  const p = panel('attend', '今日出勤', { icon: 'attend', actionLabel: '進入班表', actionHref: url || undefined });
  if (url) {
    const embed = url + (url.includes('?') ? '&' : '?') + 'embed=day';
    p._body.appendChild(el('iframe', { class: 'frame', src: embed, loading: 'lazy', title: '本日出勤' }));
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
  const p = panel('calendar', '行事曆', { icon: 'calendar' });
  if (cfg.calendarEmbedUrl) {
    p._body.appendChild(el('iframe', { class: 'frame', src: calendarSrc(cfg.calendarEmbedUrl), loading: 'lazy', title: 'Google 日曆', frameborder: '0' }));
  } else {
    p._body.appendChild(placeholder('尚未設定 Google 日曆內嵌網址<br><span class="ph-sub">（設定 → 整合日曆 → 內嵌程式碼）</span>'));
  }
  return p;
}

// 把 Google 表單「時間戳記」拆成 date(YYYY-MM-DD) 與 time(HH:MM)
function parseTimestamp(ts) {
  const s = String(ts || '').trim();
  let date = '', time = '';
  const md = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (md) date = `${md[1]}-${String(md[2]).padStart(2, '0')}-${String(md[3]).padStart(2, '0')}`;
  const mt = s.match(/(上午|下午|AM|PM)?\s*(\d{1,2}):(\d{2})/i);
  if (mt) {
    let hh = parseInt(mt[2], 10); const mm = mt[3]; const ap = mt[1] || '';
    if (ap === '下午' || /pm/i.test(ap)) { if (hh < 12) hh += 12; }
    if (ap === '上午' || /am/i.test(ap)) { if (hh === 12) hh = 0; }
    time = `${String(hh).padStart(2, '0')}:${mm}`;
  }
  return { date, time };
}
// Drive 分享連結／檔案 ID → 可顯示縮圖網址；直接圖片網址則原樣回傳
function driveThumb(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  const m = s.match(/[?&]id=([\w-]{20,})/) || s.match(/\/d\/([\w-]{20,})/) || s.match(/\/file\/d\/([\w-]{20,})/);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200';
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}
function parseImages(cell) {
  return String(cell || '').split(/[\n,]+/).map(driveThumb).filter(Boolean);
}
// 日期正規化成 YYYY-MM-DD（相容 2026/8/9、2026-8-9 等）
function normDate(s) {
  const m = String(s || '').match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : String(s || '').trim();
}
// 組別容錯：把「資訊組」「教學組」對應回內建的「資訊」「教學」；認不出的原樣保留
function canonicalGroup(raw) {
  const r = String(raw || '').trim();
  if (!r) return '';
  if (DEFAULT_GROUPS.includes(r)) return r;
  const rs = r.replace(/組$/, '');
  for (const g of DEFAULT_GROUPS) { if (rs === g || r.startsWith(g) || g.startsWith(rs)) return g; }
  return r;
}

async function loadAnnouncements(cfg) {
  if (cfg.announcementsCsvUrl) {
    try {
      const txt = await fetchText(cfg.announcementsCsvUrl);
      const rows = parseCSV(txt).filter(r => r.some(c => (c || '').trim() !== ''));
      if (rows.length) {
        const head = rows.shift().map(h => (h || '').trim());
        const findIdx = (pred) => head.findIndex(pred);
        const isTs = h => /時間戳記|timestamp/i.test(h);
        const tsIdx = findIdx(isTs);
        const gi = findIdx(h => h.includes('組'));
        const ci = findIdx(h => h.includes('內容') || h.includes('公告事項') || h.includes('公告'));
        const di = findIdx(h => h.includes('日期'));
        const ti = findIdx(h => h.includes('時間') && !isTs(h));
        const ii = findIdx(h => h.includes('照片') || h.includes('圖片') || h.includes('圖'));
        const items = rows.map(r => {
          let date = di >= 0 ? (r[di] || '').trim() : '';
          let time = ti >= 0 ? (r[ti] || '').trim() : '';
          if ((!date || !time) && tsIdx >= 0) {
            const p = parseTimestamp(r[tsIdx]);
            if (!date) date = p.date;
            if (!time) time = p.time;
          }
          return {
            group: canonicalGroup(gi >= 0 ? r[gi] : ''),
            date: normDate(date), time,
            content: ci >= 0 ? (r[ci] || '').trim() : '',
            images: ii >= 0 ? parseImages(r[ii]) : [],
          };
        }).filter(x => x.content || x.images.length);
        return { items, groups: DEFAULT_GROUPS, sample: false };
      }
    } catch (e) { console.warn('公告 CSV 讀取失敗，改用範例', e); }
  }
  return loadJSON('data/announcements-groups.json').catch(() => ({ items: [], groups: DEFAULT_GROUPS, sample: true }));
}

async function panelAnnounce(cfg) {
  const p = panel('announce', '各組公告', { icon: 'announce', scroll: true });
  const data = await loadAnnouncements(cfg);
  if (data.sample) p.querySelector('.panel__title').appendChild(el('span', { class: 'tag-sample' }, '範例'));
  const byGroup = {};
  (data.items || []).forEach(it => { (byGroup[it.group] = byGroup[it.group] || []).push(it); });
  // 內建組別順序 + 任何認不出的額外組別（附在後面，避免資料被吃掉）
  const base = (data.groups && data.groups.length) ? data.groups : DEFAULT_GROUPS;
  const extras = Object.keys(byGroup).filter(g => g && !base.includes(g));
  const groups = base.concat(extras);

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
        if (it.content) {
          const linked = esc(it.content).replace(/(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" rel="noopener">$1</a>');
          item.appendChild(el('div', { class: 'ann-item__content' }, linked));
        }
        if (it.images && it.images.length) {
          const gal = el('div', { class: 'ann-imgs' });
          it.images.forEach(src => {
            const a = el('a', { class: 'ann-img-link', href: src, target: '_blank', rel: 'noopener' });
            a.appendChild(el('img', { class: 'ann-img', src, alt: '公告圖片' }));
            gal.appendChild(a);
          });
          item.appendChild(gal);
        }
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
  const p = panel('vent', '每日呼吸器剩餘數量', { icon: 'vent', actionLabel: '詳細', actionHref: cfg.links.ventilator || undefined });
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
    if (low) tile.appendChild(el('div', { class: 'vent-tile__warn' }, '低於安全值'));
    grid.appendChild(tile);
  });
  if (!(data.types || []).length) p._body.appendChild(placeholder('尚無資料'));
  else p._body.appendChild(grid);
  return p;
}

function panelDb(cfg) {
  const p = panel('db', 'RT 資料庫', { icon: 'db' });
  p._body.appendChild(el('div', { class: 'db-panel-sub' }, 'KM 連結（科知識館分類、SOP 二/三階）＋ Drive 可下載文件（科內/院部規範、臨床指引、公文），可搜尋。'));
  p._body.appendChild(el('a', { class: 'big-link', href: '#/database' }, '開啟資料庫 →'));
  return p;
}

function panelGuides(cfg) {
  const p = panel('guides', '守則與指引', { icon: 'guides' });
  const items = [
    { t: 'RT 常規工作守則', u: cfg.links.guideDoc, icon: 'book' },
    { t: '業務快速指引', u: cfg.links.businessGuideDoc, icon: 'doc' },
  ];
  let n = 0;
  items.forEach(it => {
    if (!it.u) return;
    n++;
    const a = el('a', { class: 'link-row', href: it.u, target: '_blank', rel: 'noopener' });
    a.innerHTML = `<span class="link-row__ico">${svgIcon(it.icon)}</span><span class="link-row__t">${esc(it.t)}</span><span class="link-row__chev">↗</span>`;
    p._body.appendChild(a);
  });
  if (!n) p._body.appendChild(placeholder('連結待補'));
  return p;
}

async function panelKnowledge(cfg) {
  const p = panel('knowledge', '新知識', { icon: 'knowledge' });
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
  dash.appendChild(await panelAnnounce(cfg));
  dash.appendChild(panelCalendar(cfg));
  dash.appendChild(await panelVent(cfg));
  dash.appendChild(panelDb(cfg));
  dash.appendChild(panelGuides(cfg));
  dash.appendChild(await panelKnowledge(cfg));
  render(dash);
}

/* ---------- other tabs ---------- */
function linkCard({ icon, title, sub, href, external = true }) {
  const c = el('a', { class: 'card', href });
  if (external) { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
  const row = el('div', { class: 'card__row' });
  row.appendChild(el('div', { class: 'card__ico' }, svgIcon(icon)));
  row.appendChild(el('div', { class: 'card__body' }, `<div class="card__title">${esc(title)}</div><div class="card__sub">${esc(sub)}</div>`));
  row.appendChild(el('div', { class: 'card__chev' }, '›'));
  c.appendChild(row);
  return c;
}

async function viewVent() {
  const cfg = await ensureData();
  const url = cfg.links.ventilator;
  const nodes = [el('div', { class: 'section-title' }, '呼吸器數量')];
  nodes.push(url
    ? linkCard({ icon: 'chart', title: '每日呼吸器儀表板', sub: '即時台數、警示、歷史趨勢（開啟）', href: url })
    : el('div', { class: 'card' }, '<div class="empty">尚未設定儀表板網址</div>'));
  nodes.push(el('div', { class: 'muted-note' }, '資料每 10 分鐘更新。低於安全閾值會自動示警。'));
  render(nodes);
}

async function viewGuide() {
  const cfg = await ensureData();
  const nodes = [el('div', { class: 'section-title' }, '工作守則與指引')];
  const guideUrl = cfg.links.guideWebsite || cfg.links.guideDoc;
  nodes.push(guideUrl
    ? linkCard({ icon: 'book', title: 'RT 常規工作守則', sub: cfg.links.guideWebsite ? '可檢索網頁版（開啟）' : 'Google 文件（開啟）', href: guideUrl })
    : el('div', { class: 'card' }, `<div class="card__row"><div class="card__ico">${svgIcon('book')}</div><div class="card__body"><div class="card__title">RT 常規工作守則</div><div class="card__sub">連結待補</div></div></div>`));
  if (cfg.links.businessGuideDoc)
    nodes.push(linkCard({ icon: 'doc', title: '業務快速指引', sub: '流程圖與 SOP（Google 文件，開啟）', href: cfg.links.businessGuideDoc }));
  render(nodes);
}

async function viewSchedule() {
  const cfg = await ensureData();
  const url = cfg.links.scheduleApp;
  const nodes = [el('div', { class: 'section-title-row' },
    '<span class="section-title" style="margin:0">班表系統</span>')];
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
    ? linkCard({ icon: 'chat', title: 'RT LINE 問答機器人', sub: 'AI 依科內文件回答（加好友）', href: cfg.links.lineBot })
    : el('div', { class: 'card' }, `<div class="card__row"><div class="card__ico">${svgIcon('chat')}</div><div class="card__body"><div class="card__title">RT LINE 問答機器人</div><div class="card__sub">加好友連結待補</div></div></div>`));
  nodes.push(linkCard({ icon: 'db', title: 'RT 資料庫', sub: 'KM 連結目錄（分類 · SOP · 常用文件）', href: '#/database', external: false }));

  nodes.push(el('div', { class: 'section-title' }, '通知'));
  const on = !!localStorage.getItem('rt_push_token');
  const pushCard = el('div', { class: 'card' });
  pushCard.innerHTML = `<div class="card__row"><div class="card__ico">${svgIcon('bell')}</div><div class="card__body"><div class="card__title">推播通知</div><div class="card__sub" id="pushStatus">${on ? '✓ 已開啟通知' : '開啟後，公告更新會通知你'}</div></div></div>`;
  const pushBtn = el('button', { class: 'push-btn', type: 'button' }, on ? '重新啟用／更新' : '開啟通知');
  const testBtn = el('button', { class: 'push-btn push-btn--ghost', type: 'button' }, '測試顯示通知');
  const tokenBox = el('div', { class: 'push-token', hidden: 'hidden' });
  pushCard.appendChild(pushBtn);
  pushCard.appendChild(testBtn);
  pushCard.appendChild(tokenBox);
  nodes.push(pushCard);
  nodes.push(el('div', { class: 'muted-note', style: 'text-align:left;padding:6px 4px 0' }, 'iPhone 需先「加入主畫面」安裝後，從 App 內開啟才收得到推播；Android／電腦用瀏覽器即可。'));
  const setPushStatus = (msg, kind) => { const s = document.getElementById('pushStatus'); if (s) { s.textContent = msg; s.className = 'card__sub' + (kind === 'warn' ? ' push-warn' : (kind === 'ok' ? ' push-ok' : '')); } };
  const showToken = (t) => {
    tokenBox.hidden = false; tokenBox.innerHTML = '<div class="push-token__label">測試用 token（可複製到 Firebase 主控台傳送測試訊息）</div>';
    const ta = el('textarea', { class: 'push-token__ta', readonly: 'readonly', rows: '3' }); ta.value = t;
    tokenBox.appendChild(ta);
  };
  pushBtn.addEventListener('click', () => enablePush(cfg, setPushStatus, showToken));
  testBtn.addEventListener('click', async () => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) { setPushStatus('此裝置不支援通知', 'warn'); return; }
      let perm = Notification.permission;
      if (perm !== 'granted') perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushStatus('尚未允許通知，無法測試', 'warn'); return; }
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('測試通知 — RT Dashboard', {
        body: '你看到這則，代表通知顯示正常 ✓', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'rt-test',
      });
      setPushStatus('已送出測試通知，請看系統通知列', 'ok');
    } catch (e) { setPushStatus('測試失敗：' + ((e && e.message) || e), 'warn'); }
  });

  nodes.push(el('div', { class: 'section-title' }, '關於'));
  nodes.push(el('div', { class: 'card' },
    `<div class="card__title">${esc(cfg.appName)}</div><div class="card__sub">${esc(cfg.org)}　版本 ${esc(cfg.version)}</div>`));
  nodes.push(el('div', { class: 'muted-note' }, '在瀏覽器選單選「加到主畫面」即可安裝成 App。'));
  render(nodes);
}

async function viewDatabase() {
  const cfg = await ensureData();
  const db = await loadJSON('data/database.json').catch(() => ({ groups: [] }));
  let groups = db.groups || [];
  // Drive 群組改由 Apps Script 即時取得（丟進 Drive 就同步）；失敗則沿用 database.json 快照
  if (cfg.driveJsonUrl) {
    try {
      const res = await fetch(cfg.driveJsonUrl, { cache: 'no-cache' });
      if (res.ok) {
        const live = await res.json();
        if (live && Array.isArray(live.groups)) {
          const km = groups.filter(g => g.source !== 'drive');
          const drive = live.groups.map(g => ({ title: g.title, type: 'doc', source: 'drive', folderUrl: g.folderUrl, items: g.items || [] }));
          groups = km.concat(drive);
        }
      }
    } catch (e) { console.warn('Drive 清單即時讀取失敗，沿用快照', e); }
  }
  const total = groups.reduce((n, g) => n + (g.items || []).length, 0);

  const wrap = el('div', { class: 'fade-in' });
  const head = el('div', { class: 'section-title-row' });
  head.appendChild(el('span', { class: 'section-title', style: 'margin:0' }, 'RT 資料庫'));
  head.appendChild(el('a', { class: 'panel__action', href: '#/home' }, '← 回首頁'));
  wrap.appendChild(head);
  if (db.note) wrap.appendChild(el('div', { class: 'db-note' }, esc(db.note)));

  const search = el('input', { class: 'db-search', type: 'search', placeholder: `搜尋 ${total} 筆文件／分類…`, 'aria-label': '搜尋資料庫' });
  wrap.appendChild(search);
  const list = el('div', {});
  wrap.appendChild(list);

  const draw = (q) => {
    list.innerHTML = '';
    const query = (q || '').trim().toLowerCase();
    let shown = 0;
    groups.forEach(g => {
      const items = (g.items || []).filter(it => !query || it.name.toLowerCase().includes(query));
      if (!items.length) return;
      shown += items.length;
      const sec = el('section', { class: 'acc' + (query ? ' is-open' : '') });
      const btn = el('button', { class: 'acc__head', type: 'button' });
      const tag = g.source === 'drive'
        ? '<span class="acc__tag acc__tag--dl">可下載</span>'
        : (g.source === 'km' ? '<span class="acc__tag acc__tag--net">內網</span>' : '');
      btn.innerHTML = `<span class="acc__ico">${svgIcon(g.type === 'folder' ? 'db' : 'doc')}</span><span class="acc__title">${esc(g.title)}</span>${tag}<span class="acc__count">${items.length}</span><span class="acc__chev">▾</span>`;
      const body = el('div', { class: 'acc__body' });
      if (g.folderUrl) {
        const f = el('a', { class: 'link-row link-row--folder', href: g.folderUrl, target: '_blank', rel: 'noopener' });
        f.innerHTML = `<span class="link-row__ico">${svgIcon('db')}</span><span class="link-row__t">開啟整個資料夾（Drive）</span><span class="link-row__chev">↗</span>`;
        body.appendChild(f);
      }
      items.forEach(it => {
        const a = el('a', { class: 'link-row', href: it.url, target: '_blank', rel: 'noopener' });
        a.innerHTML = `<span class="link-row__t">${esc(it.name)}</span><span class="link-row__chev">↗</span>`;
        body.appendChild(a);
      });
      btn.addEventListener('click', () => sec.classList.toggle('is-open'));
      sec.appendChild(btn); sec.appendChild(body);
      list.appendChild(sec);
    });
    if (!shown) list.appendChild(el('div', { class: 'empty' }, '找不到符合的項目'));
    else if (!query) { const f = list.querySelector('.acc'); if (f) f.classList.add('is-open'); }
  };
  draw('');
  search.addEventListener('input', () => draw(search.value));
  render(wrap);
}

/* ---------- 推播（Firebase FCM Web Push） ---------- */
const FB_VER = '10.12.5';
let fbMessaging = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const abs = new URL(src, location.href).href;
    if ([...document.scripts].some(s => s.src === abs)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('載入失敗 ' + src));
    document.head.appendChild(s);
  });
}
async function initMessaging(fbConf) {
  await loadScript('vendor/firebase-app-compat.js');
  await loadScript('vendor/firebase-messaging-compat.js');
  if (!window.firebase.apps.length) window.firebase.initializeApp(fbConf);
  if (!fbMessaging) fbMessaging = window.firebase.messaging();
  return fbMessaging;
}
function pushSupport() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !standalone) return 'ios-need-install';
  return 'ok';
}
async function enablePush(cfg, setStatus, showToken) {
  const p = cfg.push || {};
  if (!p.vapidKey || !p.firebase) { setStatus('推播尚未設定完成（缺金鑰）', 'warn'); return; }
  const sup = pushSupport();
  if (sup === 'unsupported') { setStatus('此裝置／瀏覽器不支援推播', 'warn'); return; }
  if (sup === 'ios-need-install') { setStatus('iPhone 請先用 Safari「分享 → 加入主畫面」安裝，再從 App 內開啟通知', 'warn'); return; }
  setStatus('處理中…');
  try {
    const messaging = await initMessaging(p.firebase);
    // 用主要的 sw.js 當推播接收者（不另外註冊含 Firebase 的 SW，避免 compat 在 SW 內找不到 window）
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { setStatus('你尚未允許通知（可到瀏覽器的網站設定開啟）', 'warn'); return; }
    try { await messaging.deleteToken(); } catch (_) {} // 清掉可能綁在舊 SW 的過期 token，強制重取
    const token = await messaging.getToken({ vapidKey: p.vapidKey, serviceWorkerRegistration: reg });
    if (!token) { setStatus('取得推播 token 失敗，請重試', 'warn'); return; }
    localStorage.setItem('rt_push_token', token);
    if (p.registerUrl) { try { await fetch(p.registerUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: token, ua: navigator.userAgent }) }); } catch (_) {} }
    try { messaging.onMessage((payload) => { const n = payload.notification || payload.data || {}; new Notification(n.title || '中榮 RT Dashboard', { body: n.body || '', icon: 'icons/icon-192.png' }); }); } catch (_) {}
    setStatus('✓ 已開啟通知', 'ok');
    if (showToken) showToken(token);
  } catch (e) {
    setStatus('開啟失敗：' + ((e && e.message) || e), 'warn');
  }
}

/* ---------- router ---------- */
const routes = { home: viewDashboard, vent: viewVent, guide: viewGuide, schedule: viewSchedule, more: viewMore, database: viewDatabase };
async function route() {
  const hash = (location.hash || '#/home').replace('#/', '');
  const name = routes[hash] ? hash : 'home';
  const tabName = name === 'database' ? 'more' : name;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabName));
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
