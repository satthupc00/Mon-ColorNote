// Mon TriNote — giao diện chính (dùng chung cho PC và Android)
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/baloo-2/700.css';
import './style.css';
import iconUrl from '../build/icon.png';
import * as DB from './store.js';
import * as C from './crypto.js';
import * as P from './platform.js';
import { I } from './icons.js';
import { sampleStickers, sampleNotes, sampleVault } from './sample.js';
import { deathAnniversary, canChi } from './lunar.js';
import * as IMG from './images.js';

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pref = (k, d) => { try { const v = localStorage.getItem('tn:pref:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem('tn:pref:' + k, JSON.stringify(v)); } catch {} };
const fmtDate = t => {
  if (!t) return '';
  const d = new Date(t), n = new Date(), hm = d.toTimeString().slice(0, 5);
  if (d.toDateString() === n.toDateString()) return 'Hôm nay ' + hm;
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Hôm qua ' + hm;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// ---------------- trạng thái giao diện ----------------
const S = {
  tab: pref('tab', 1), theme: pref('theme', 'dark'),
  t2sel: null, t2sort: pref('t2sort', 'manual'), t2open: false, t2new: false,
  doneOpen: pref('doneOpen', {}),
  t3: 'lock', pin: '', pin1: '', pinErr: '', recovery: '', t3g: null, q: '', closed: pref('closed', {}), show: {}, editAcc: null, t3new: false,
  dlg: null, upd: { ev: 'idle' }, version: '', compact: false, wide: false, bio: false, bioOn: pref('bio', true),
  login: { email: '', msg: '', err: false, busy: false }
};
let MK = null, MKB64 = null, MKID = null, vaultCache = [], leftTab3At = 0;

// ---------------- dữ liệu ----------------
const STK_COLORS = ['y', 'm', 'p', 'l', 's'];
const stickers = () => DB.all('stickers').sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
const notes = () => {
  const n = DB.all('notes');
  return S.t2sort === 'date' ? n.sort((a, b) => (b.editedAt || 0) - (a.editedAt || 0)) : n.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};
const secMeta = () => DB.get('meta', 'sec');
const groups = () => vaultCache.filter(v => v.kind === 'group').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const accsOf = gid => vaultCache.filter(v => v.kind === 'acc' && v.groupId === gid).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

async function refreshVault() {
  if (!MK) { vaultCache = []; return; }
  const out = [];
  for (const it of DB.all('vault')) {
    if (it.keyId !== MKID) continue;
    try { out.push({ id: it.id, ...(await C.decryptObj(MK, it)) }); } catch {}
  }
  vaultCache = out;
}
async function saveVault(obj) {
  const { id, ...plain } = obj;
  const box = await C.encryptObj(MK, plain);
  DB.put('vault', { id, keyId: MKID, ...box });
  const i = vaultCache.findIndex(v => v.id === id);
  if (i >= 0) vaultCache[i] = obj; else vaultCache.push(obj);
}
function deleteVault(id) { DB.remove('vault', id); vaultCache = vaultCache.filter(v => v.id !== id); }

// ---------- ghi chú định dạng (Tab Xanh dương) ----------
// Giữ: đậm, nghiêng, gạch dưới, gạch ngang, màu chữ, cỡ chữ, tiêu đề, danh sách, bảng, hình.
// Màu lưu ở data-c (màu gốc), lúc hiển thị tự chỉnh sáng/tối cho hợp theme để luôn đọc được.
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'KBD', 'SPAN', 'IMG', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'HR', 'SUB', 'SUP']);
const DROP_TAGS = new Set(['STYLE', 'SCRIPT', 'META', 'TITLE', 'HEAD', 'LINK', 'XML', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'SVG', 'BUTTON', 'INPUT']);
const ctx2d = document.createElement('canvas').getContext('2d');
function normColor(c) {
  if (!c) return null;
  ctx2d.fillStyle = '#000'; ctx2d.fillStyle = c; const v = ctx2d.fillStyle;
  if (!/^#[0-9a-f]{6}$/i.test(v)) return null;
  const L = lum(v); return L < .06 || L > .94 ? null : v; // đen / trắng = màu mặc định, bỏ
}
function lum(hex) { const n = parseInt(hex.slice(1), 16); return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255; }
function mix(hex, to, t) { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16); const ch = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; }
const themed = hex => { const L = lum(hex); return S.theme === 'dark' ? (L < .5 ? mix(hex, '#ffffff', .5 - L * .4) : hex) : (L > .72 ? mix(hex, '#000000', .45) : hex); };
function fontPx(v) {
  const m = /^([\d.]+)(pt|px)$/.exec((v || '').trim()); if (!m) return null;
  const px = +m[1] * (m[2] === 'pt' ? 4 / 3 : 1);
  return px >= 13 && px <= 16.5 ? null : Math.round(Math.min(30, Math.max(11, px)));
}
function clean(html, paste) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const walk = el => {
    for (const c of [...el.childNodes]) {
      if (c.nodeType === 8) { c.remove(); continue; }
      if (c.nodeType === 3) { if (paste) c.textContent = c.textContent.replace(/[\r\n]+/g, ' '); continue; }
      if (c.nodeType !== 1) { c.remove(); continue; }
      const tag = c.tagName;
      if (DROP_TAGS.has(tag)) { c.remove(); continue; }
      walk(c);
      const st = c.style || {};
      // đọc định dạng từ style / thẻ cũ
      const col = c.getAttribute('data-c') || normColor(st.color || c.getAttribute('color'));
      const fs = c.getAttribute('data-fs') || fontPx(st.fontSize);
      const fw = st.fontWeight, bold = fw === 'bold' || +fw >= 600, notBold = fw === 'normal' || (+fw && +fw < 600);
      const ital = st.fontStyle === 'italic', deco = (st.textDecoration || st.textDecorationLine || '');
      const imgId = c.getAttribute('data-img'), imgSrc = c.getAttribute('src');
      if (tag === 'IMG') {
        [...c.attributes].forEach(a => c.removeAttribute(a.name));
        if (imgId) c.setAttribute('data-img', imgId);
        else if (paste && imgSrc) c.setAttribute('data-src', imgSrc);
        else { c.remove(); continue; }
        continue;
      }
      if (!OK_TAGS.has(tag) || ((tag === 'B' || tag === 'STRONG') && notBold)) {
        // thẻ lạ (FONT, A, O:P…): giữ chữ, chuyển định dạng sang span
        const sp = doc.createElement('span'); sp.append(...c.childNodes);
        if (col) sp.setAttribute('data-c', col); if (fs) sp.setAttribute('data-fs', fs);
        let node = sp;
        if (bold && tag !== 'B') { const b = doc.createElement('b'); b.append(node); node = b; }
        if (ital) { const i = doc.createElement('i'); i.append(node); node = i; }
        if (deco.includes('underline')) { const u = doc.createElement('u'); u.append(node); node = u; }
        if (deco.includes('line-through')) { const x = doc.createElement('s'); x.append(node); node = x; }
        c.replaceWith(...(sp.attributes.length || node !== sp ? [node] : [...sp.childNodes]));
        continue;
      }
      [...c.attributes].forEach(a => c.removeAttribute(a.name));
      if (col) c.setAttribute('data-c', col);
      if (fs) c.setAttribute('data-fs', fs);
      // in đậm / nghiêng / gạch dưới viết bằng style → bọc thẻ thật
      const wrapIn = t => { const w = doc.createElement(t); w.append(...c.childNodes); c.append(w); };
      if (bold && !/^(B|STRONG|H\d|TH)$/.test(tag)) wrapIn('b');
      if (ital && tag !== 'I' && tag !== 'EM') wrapIn('i');
      if (deco.includes('underline') && tag !== 'U') wrapIn('u');
      if (deco.includes('line-through') && !/^(S|STRIKE|DEL)$/.test(tag)) wrapIn('s');
    }
  };
  walk(root);
  return root.innerHTML;
}
// tô màu/cỡ chữ theo theme lúc hiển thị (không lưu vào dữ liệu)
function paint(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.querySelectorAll('[data-c],[data-fs]').forEach(el => {
    const c = el.getAttribute('data-c'), f = el.getAttribute('data-fs');
    el.setAttribute('style', (c ? `color:${themed(c)};` : '') + (f ? `font-size:${f}px;` : ''));
  });
  doc.querySelectorAll('img[data-img]').forEach(el => el.setAttribute('alt', ''));
  return doc.body.firstChild.innerHTML;
}
// gắn ảnh thật vào các <img data-img> đang hiển thị
function hydrateImgs() {
  app.querySelectorAll('img[data-img]:not([src])').forEach(async el => {
    const src = await IMG.load(el.dataset.img);
    if (src) el.src = src; else el.classList.add('missing');
  });
}
const saveNoteBody = (id, ed) => { const n = DB.get('notes', id); if (n) DB.put('notes', { ...n, body: clean(ed.innerHTML), editedAt: Date.now() }); };
// dán từ Word / Google Docs / web: giữ định dạng, lấy cả hình
async function pasteRich(e, ed) {
  const cd = e.clipboardData, html = cd.getData('text/html');
  const files = [...cd.files].filter(f => f.type.startsWith('image/'));
  if (!html && !files.length) return; // để trình duyệt tự dán chữ thường
  e.preventDefault();
  const noteId = S.t2sel;
  let body = html ? clean(html.replace(/^[\s\S]*<!--StartFragment-->|<!--EndFragment-->[\s\S]*$/g, ''), true) : '';
  if (!body.includes('<img') && files.length) body += files.map(() => '<img data-src="file-slot">').join('');
  // chèn đúng vị trí con trỏ, giữ nguyên thuộc tính (insertHTML của trình duyệt làm mất màu gốc)
  const sel = getSelection(); let rg = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!rg || !ed.contains(rg.commonAncestorContainer)) { rg = document.createRange(); rg.selectNodeContents(ed); rg.collapse(false); }
  rg.deleteContents();
  const frag = rg.createContextualFragment(paint(body)), last = frag.lastChild;
  rg.insertNode(frag);
  if (last) { rg.setStartAfter(last); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg); }
  const pending = [...ed.querySelectorAll('img[data-src]')];
  if (!pending.length) return saveNoteBody(noteId, ed);
  toast(`Đang lưu ${pending.length} hình…`);
  let fail = 0, fileIdx = 0;
  for (const im of pending) {
    const src = im.getAttribute('data-src');
    try {
      let data = null;
      if (src.startsWith('data:image')) data = src;
      else if (/^https?:/.test(src)) { const r = await fetch(src); if (r.ok) data = await r.blob(); }
      else if (src.startsWith('file:') && window.desktop?.readClipImage) data = await window.desktop.readClipImage(src);
      if (!data && files[fileIdx]) data = files[fileIdx++];
      if (!data) throw 0;
      const id = await IMG.save(await IMG.compress(data));
      im.removeAttribute('data-src'); im.setAttribute('data-img', id); im.src = await IMG.load(id);
    } catch { fail++; im.remove(); }
  }
  saveNoteBody(noteId, ed);
  toast(fail ? `Có ${fail} hình không lấy được. Copy riêng từng hình rồi dán vào nhé` : `Đã dán kèm ${pending.length} hình`);
}

// ---------------- render ----------------
let pendingRender = false;
const editing = () => { const a = document.activeElement; return a && app.contains(a) && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
function render(force) {
  if (!force && editing() && !S.dlg) { pendingRender = true; return; }
  pendingRender = false;
  const w = window.innerWidth;
  S.compact = w < 600; S.wide = w >= 900;
  app.dataset.at = S.theme;
  const cls = 'app' + (S.compact ? ' compact' : '') + (matchMedia('(pointer:coarse)').matches ? ' touch' : '') + (P.isDesktop ? ' desktop' : '');
  if (app.className !== cls) app.className = cls;
  document.body.style.background = S.theme === 'light' ? '#F3F5F9' : '#1B1D23';
  // giữ vị trí cuộn để vẽ lại không bị nhảy
  const scrolls = [...app.querySelectorAll('.scroll,.list,.editor,.chips')].map(el => [el.className.split(' ')[0], el.scrollTop, el.scrollLeft]);
  const main = S.tab === 1 ? tab1() : S.tab === 2 ? tab2() : tab3();
  const fab = fabHtml();
  // khung cố định; mỗi lần chỉ thay phần nào thật sự đổi (header, tab, nội dung…) để không bị nháy
  const mode = S.wide ? 'wide' : 'narrow';
  if (shell !== mode) {
    shell = mode; parts = {};
    app.innerHTML = S.wide
      ? `<div id="p-hdr" class="part"></div><div class="body"><nav class="rail" aria-label="Tab"><div id="p-nav" class="part"></div><span class="rail-ind" id="ind"></span></nav><main id="p-main" class="main"></main></div>
         <footer class="foot"><span id="p-foot"></span><span class="credit">Created by Mondiro</span></footer><div id="p-dlg" class="part"></div>`
      : `<div id="p-hdr" class="part"></div><main id="p-main" class="main"></main>
         <nav class="bnav" aria-label="Tab"><div id="p-nav" class="part"></div><span class="credit credit-m">Created by Mondiro</span></nav><div id="p-dlg" class="part"></div>`;
  }
  setPart('p-hdr', header());
  setPart('p-nav', tabs());
  const mainEl = document.getElementById('p-main');
  if (mainEl.className !== 'main tint' + S.tab) mainEl.className = 'main tint' + S.tab;
  setPart('p-main', main + fab);
  if (S.wide) setPart('p-foot', footInfo());
  setPart('p-dlg', dialog());
  const ind = document.getElementById('ind'), b = app.querySelector('.rail .tabbtn[aria-selected="true"]');
  if (ind && b) {
    const top = (b.offsetTop + 6) + 'px';
    if (!ind.style.top) { ind.style.transition = 'none'; ind.style.top = top; ind.offsetTop; ind.style.transition = ''; }
    ind.style.top = top; ind.style.background = getComputedStyle(b).backgroundColor;
  }
  if (lastTheme !== S.theme) { lastTheme = S.theme; if (P.isDesktop) window.desktop.setTheme?.(S.theme); P.setSystemBars(S.theme); }
  hydrateImgs();
  const pwIn = app.querySelector('.pw input');
  if (pwIn && !S.dlg && !app.querySelector('.pw input:focus')) pwIn.focus();
  for (const [cls, top, left] of scrolls) { const el = app.querySelector('.' + cls); if (el) { el.scrollTop = top; el.scrollLeft = left; } }
}
// chỉ chạy hiệu ứng xuất hiện cho phần tử mới, không chạy lại mỗi lần vẽ
let lastTheme = null, shell = null, parts = {};
function setPart(id, html) { if (parts[id] === html) return; parts[id] = html; document.getElementById(id).innerHTML = html; }
const seen = new Set();
const enter = id => { if (seen.has(id)) return ''; seen.add(id); return ' enter'; };
// FLIP: ghi vị trí cũ, thay đổi DOM, rồi trượt mượt từ chỗ cũ sang chỗ mới
const EASE = 'cubic-bezier(.22,1,.36,1)';
function flip(sel, keyOf, mutate, dur = 340) {
  const first = new Map();
  app.querySelectorAll(sel).forEach(el => first.set(keyOf(el), el.getBoundingClientRect()));
  mutate();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  app.querySelectorAll(sel).forEach(el => {
    const f = first.get(keyOf(el)), l = el.getBoundingClientRect();
    if (!f) { el.animate([{ opacity: 0, scale: .92 }, { opacity: 1, scale: 1 }], { duration: 260, easing: EASE }); return; }
    const dx = f.left - l.left, dy = f.top - l.top;
    if (Math.abs(dx) > .5 || Math.abs(dy) > .5) el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: dur, easing: EASE });
  });
}
const footInfo = () => {
  if (S.tab === 1) { const s = stickers(); return `${s.length} sticker · ${s.reduce((n, x) => n + (x.items || []).filter(i => !i.done).length, 0)} mục chưa xong`; }
  if (S.tab === 2) return `${DB.all('notes').length} phần mềm`;
  return MK ? `${groups().length} nhóm · ${vaultCache.filter(v => v.kind === 'acc').length} thẻ · đã mã hóa` : 'Đã khóa';
};

// Góc phải trên (m-skill §2b): [chấm đồng bộ] [cài đặt] [cập nhật]
const SYNC_TXT = st => ({ local: 'Chỉ lưu trên máy này', offline: DB.currentUser() ? 'Ngoại tuyến, sẽ đồng bộ khi có mạng' : 'Đăng nhập để đồng bộ', syncing: 'Đang đồng bộ…', synced: 'Đã đồng bộ', error: 'Lỗi đồng bộ' }[st]);
function syncDot() {
  const st = DB.syncState.status, user = DB.currentUser();
  const cls = { synced: 'synced', syncing: 'pending', error: 'error' }[st] || '';
  const txt = SYNC_TXT(st) + (user ? ' · ' + user.email : '');
  return `<button type="button" class="syncdot ${cls}" data-act="sync-info" title="${esc(txt)}" aria-label="Đồng bộ: ${esc(txt)}"><i></i></button>`;
}
function updButton() {
  const u = S.upd;
  const st = { checking: 'checking', progress: 'checking', available: 'avail', downloaded: 'avail', latest: 'ok', error: 'err' }[u.ev] || '';
  const tip = { checking: 'Đang kiểm tra cập nhật…', progress: `Đang tải bản mới ${u.percent || 0}%`, available: `Có bản mới ${u.version || ''} · bấm để cập nhật`,
    downloaded: P.isDesktop ? 'Đã tải xong · bấm để khởi động lại và cài' : 'Đang mở trình cài đặt', latest: 'Kiểm tra cập nhật · Đã là bản mới nhất', error: 'Kiểm tra cập nhật · ' + (u.message || 'lỗi') }[u.ev] || 'Kiểm tra cập nhật';
  const act = u.ev === 'available' ? 'upd-install' : u.ev === 'downloaded' && P.isDesktop ? 'upd-restart' : 'upd-check';
  return `<button type="button" class="ibtn upd ${st}" data-act="${act}" title="${esc(tip)}" aria-label="${esc(tip)}" ${st === 'checking' ? 'disabled' : ''}>${I.refresh}</button>${!P.isDesktop && u.ev === 'latest' ? '<span class="latest">latest</span>' : ''}`;
}
const phoneUI = () => !P.isDesktop && (P.isAndroid || !S.wide);
function header() {
  const right = `${syncDot()}<button type="button" class="ibtn" data-act="settings" title="Cài đặt (Ctrl+,)" aria-label="Cài đặt">${I.gear}</button>${updButton()}`;
  // Điện thoại (m-skill §5): không có logo + tên, chỉ 1 hàng icon mỏng ở góc phải
  if (phoneUI()) return `<header class="hdr thin">${right}</header>`;
  return `<header class="hdr">
    <div class="brand"><img src="${iconUrl}" alt="">
      <div class="brand-name"><span><span class="m">Mon</span> <span class="a">TriNote</span></span>${S.upd.ev === 'latest' ? '<span class="latest">latest</span>' : ''}</div></div>
    <div class="tools">${right}</div>
  </header>`;
}
const TAB_TIPS = ['', 'Sticker việc cần làm (Ctrl+1)', 'Ghi chú phần mềm (Ctrl+2)', 'Tài khoản bảo mật (Ctrl+3)'];
const tabs = () => [1, 2, 3].map(t => `<button class="tabbtn" data-t="${t}" data-act="tab" aria-selected="${S.tab === t}" aria-label="${TAB_TIPS[t]}" title="${TAB_TIPS[t]}"></button>`).join('');

function fabHtml() {
  if (S.tab === 1 && !S.wide) return `<button class="fab" data-act="stk-new" aria-label="Sticker mới">${I.plus}</button>`;
  if (S.tab === 3 && MK && S.t3 === 'open' && groups().length && !S.editAcc) return `<button class="fab" data-act="acc-new" title="Thêm tài khoản (Ctrl+N)" aria-label="Thêm tài khoản">${I.plus}</button>`;
  return '';
}

// ---------- Tab 1 ----------
const rotOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ((h % 7) - 3) * .5; };
const DONE_MAX = 3;
// Sticker cố định: Đám giỗ má (ngày mất 31/10/2021 dương lịch), tự tính ngày dương lịch theo từng năm
const GIO_DEATH = [31, 10, 2021];
const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const pad2 = n => String(n).padStart(2, '0');
function gioSticker() {
  const now = new Date(), y = now.getFullYear();
  const today = new Date(y, now.getMonth(), now.getDate());
  const { lunar, solar } = deathAnniversary(GIO_DEATH, y);
  const d = new Date(solar[2], solar[1] - 1, solar[0]);
  const days = Math.round((d - today) / 86400000);
  let chip;
  if (days > 0) chip = `<span class="gio-chip">Còn ${days} ngày</span>`;
  else if (days === 0) chip = `<span class="gio-chip today">Hôm nay</span>`;
  else { const n = deathAnniversary(GIO_DEATH, y + 1).solar; chip = `<span class="gio-chip past">Đã qua · năm sau ${pad2(n[0])}/${pad2(n[1])}/${n[2]}</span>`; }
  return `<div class="stk gio" aria-label="Đám giỗ má">
    <div class="gio-h">${I.lotus}<b>Đám giỗ má</b></div>
    <div class="gio-date"><small>${WD[d.getDay()]}</small>${pad2(solar[0])}/${pad2(solar[1])}/${solar[2]}</div>
    ${chip}
    <div class="gio-meta">Âm lịch ${lunar.day}/${lunar.month} năm ${canChi(y)}<br>Giỗ năm thứ ${y - GIO_DEATH[2]} · mất ${pad2(GIO_DEATH[0])}/${pad2(GIO_DEATH[1])}/${GIO_DEATH[2]}</div>
  </div>`;
}
function stickerHtml(s) {
  const items = s.items || [];
  const todo = items.filter(x => !x.done), done = items.filter(x => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const open = !!S.doneOpen[s.id], shown = open ? done : done.slice(0, DONE_MAX);
  const row = x => `<div class="it" data-s="${s.id}" data-i="${x.id}"><input type="checkbox" ${x.done ? 'checked' : ''} data-act="it-chk" aria-label="Đánh dấu xong"><span class="it-t" contenteditable="plaintext-only" data-edit="it">${esc(x.text)}</span><button class="x" data-act="it-del" aria-label="Xóa mục" title="Xóa mục">${I.x14}</button></div>`;
  return `<div class="stk ${s.color || 'y'}${enter('s' + s.id)}" style="--rot:${rotOf(s.id)}deg" data-s="${s.id}">
    <div class="stk-h"><span class="stk-t" contenteditable="plaintext-only" data-edit="stk-title" data-s="${s.id}">${esc(s.title)}</span><button class="more" data-act="stk-menu" data-s="${s.id}" aria-label="Tùy chọn sticker" title="Đổi màu / xóa">${I.dots}</button></div>
    ${todo.map(row).join('')}
    <div class="addit">${I.plus14}<input data-add="${s.id}" placeholder="Thêm mục" enterkeyhint="done" aria-label="Thêm mục"></div>
    ${done.length ? `<div class="done"><div class="done-h">Đã xong (${done.length})${done.length > DONE_MAX ? `<button class="dtog" data-act="done-tog" data-s="${s.id}" aria-expanded="${open}" title="${open ? 'Thu gọn' : 'Xem hết'}">${open ? 'Thu gọn' : `+${done.length - DONE_MAX}`}${I.chev}</button>` : ''}<button class="clr" data-act="clr" data-s="${s.id}">Xóa hết</button></div>${shown.map(row).join('')}</div>` : ''}
  </div>`;
}
function tab1() {
  const list = stickers();
  const gioOrder = (DB.get('meta', 'gio') || {}).order ?? Infinity;
  const all = [{ gio: true, order: gioOrder }, ...list].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
  const body = `<div class="wall">${all.map(x => x.gio ? gioSticker() : stickerHtml(x)).join('')}</div>${list.length ? '' : `<div class="empty"><b>Chưa có sticker nào</b>Bấm "Sticker mới" để dán tờ đầu tiên lên tường.</div>`}`;
  return `<div class="bar"><h2>Bảng sticker</h2>${S.wide ? `<button class="btn pri" data-act="stk-new" title="Sticker mới (Ctrl+N)">${I.plus14}Sticker mới</button>` : ''}</div><div class="scroll">${body}</div>`;
}

// ---------- Tab 2 ----------
function tab2() {
  const list = notes();
  if (S.t2sel && !DB.get('notes', S.t2sel)) S.t2sel = null;
  if (!S.t2sel && list.length && !S.compact) S.t2sel = list[0].id;
  const manual = S.t2sort === 'manual';
  const lp = `<div class="lpane"><div class="lhead"><b>Phần mềm</b><button class="ibtn sm" data-act="note-new" title="Thêm phần mềm" aria-label="Thêm phần mềm">${I.plus14}</button></div>
    <div class="sortseg"><button data-act="sort" data-v="manual" aria-pressed="${manual}">Tự sắp xếp</button><button data-act="sort" data-v="date" aria-pressed="${!manual}">Mới sửa</button></div>
    ${S.t2new ? `<div class="newname"><input id="newnote" placeholder="Tên phần mềm" enterkeyhint="done"><button class="btn pri" data-act="note-add">Thêm</button></div>` : ''}
    <div class="list">${list.length ? list.map((a, i) => `<div class="li" data-act="note-pick" data-id="${a.id}" aria-current="${!S.compact && a.id === S.t2sel}">
      ${manual ? `<span class="grip" title="Giữ rồi kéo để đổi vị trí">${I.grip}</span>` : ''}
      <span class="dot" style="background:${hue(a.name)}33;color:${hue(a.name)}">${esc((a.name || '?')[0].toUpperCase())}</span>
      <span class="nm"><b>${esc(a.name)}</b><small>Sửa ${fmtDate(a.editedAt)}</small></span>
    </div>`).join('') : `<div class="empty" style="padding:24px 8px">Thêm tên phần mềm đầu tiên, ví dụ "Spine 3.7.94".</div>`}</div></div>`;
  const cur = S.t2sel && DB.get('notes', S.t2sel);
  const dp = cur ? `<div class="dpane"><div class="dhead">${S.compact ? `<button class="back" data-act="back2" aria-label="Quay lại">${I.back}</button>` : ''}
      <h2 contenteditable="plaintext-only" data-edit="note-name">${esc(cur.name)}</h2><button class="more" data-act="note-menu" aria-label="Tùy chọn" title="Xóa">${I.dots}</button></div>
      <div class="meta">Sửa lần cuối ${fmtDate(cur.editedAt)} · tự lưu</div>
      <div class="editor" contenteditable="true" spellcheck="false" data-edit="note-body">${paint(clean(cur.body))}</div></div>`
    : `<div class="dpane"><div class="empty"><b>Chọn một phần mềm</b>Hoặc bấm + để thêm mới.</div></div>`;
  if (S.compact) return `<div class="ld">${S.t2open && cur ? dp : lp}</div>`;
  return `<div class="ld">${lp}${dp}</div>`;
}
function hue(s) { const cols = ['#F29A9C', '#86BDF0', '#F2B84B', '#7FD49B', '#B9A6F5', '#F5A6D8', '#7ED6D6']; let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return cols[h % cols.length]; }

// ---------- Tab 3 ----------
const dots = n => `<div class="pin-dots ${S.pinErr ? 'shake' : ''}">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < n ? 'f' : ''}"></i>`).join('')}</div>`;
const pad = () => `<div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'x', 0, '⌫'].map(k => k === 'x' ? '<span></span>' : `<button data-act="pin" data-k="${k}" aria-label="${k === '⌫' ? 'Xóa' : k}">${k}</button>`).join('')}</div>`;
// PC: ô gõ mật khẩu (cho phép cả chữ). Điện thoại: bàn phím số, có nút chuyển sang gõ chữ.
const textMode = () => P.isDesktop || S.pinText;
const PW = () => textMode() ? 'mật khẩu' : 'mã PIN';
// Ô mật khẩu dài (m-skill §2.2): nút mắt + mũi tên đỏ, Enter để gửi
const pwField = (id, ph, go) => `<div class="pw ${S.pinErr && go ? 'shake' : ''}"><input type="password" id="${id}" placeholder="${ph}" aria-label="${ph}" autocomplete="off" enterkeyhint="${go ? 'go' : 'next'}" spellcheck="false">
  <button type="button" class="ibtn eye" data-eye title="Hiện/ẩn mật khẩu" aria-label="Hiện/ẩn mật khẩu">${I.eye}</button>
  ${go ? `<button type="submit" class="ibtn go" title="${go} (Enter)" aria-label="${go}">${I.arrowR}</button>` : ''}</div>`;
const lockHead = (title, sub) => `<img class="lock-logo" src="${iconUrl}" alt=""><div class="brand-name lock-name"><span class="m">Mon</span> <span class="a">TriNote</span></div>
  <h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<div class="err">${esc(S.pinErr)}</div>`;
function pwScreen(kind) {
  const meta = secMeta();
  if (kind === 'unlock') return lockHead('Tab Đỏ đang khóa', '') + `<form class="pwf" data-form="unlock" autocomplete="off">${pwField('pw', 'Mật khẩu', 'Mở khóa')}</form>`;
  if (kind === 'create') return lockHead('Tạo mật khẩu', 'Dùng chữ, số, khoảng trắng hay tiếng Việt có dấu đều được. Có phân biệt chữ hoa, chữ thường.') +
    (!DB.currentUser() && DB.hasFirebase ? `<p class="warn">Nên đăng nhập (Cài đặt) trước để mọi máy dùng chung một két.</p>` : '') +
    `<form class="pwf" data-form="create" autocomplete="off">${pwField('pw', 'Mật khẩu mới', '')}${pwField('pw2', 'Nhập lại mật khẩu', 'Tạo mật khẩu')}</form>`;
  // đổi mật khẩu: cần mật khẩu cũ, trừ khi vừa mở bằng mã khôi phục
  return lockHead('Đổi mật khẩu', '') + `<form class="pwf" data-form="change" autocomplete="off">${S.recovered || !meta ? '' : pwField('pwold', 'Mật khẩu cũ', '')}${pwField('pw', 'Mật khẩu mới', '')}${pwField('pw2', 'Nhập lại mật khẩu mới', 'Lưu')}</form>
    <button class="linkbtn" data-act="t3-cancel-change">Hủy</button>`;
}
function pinUI(btn) {
  return `${dots(S.pin.length)}<div class="err">${esc(S.pinErr)}</div>${pad()}<button class="linkbtn" data-act="pin-text">Mật khẩu có chữ? Gõ bằng bàn phím</button>`;
}
function tab3() {
  const meta = secMeta();
  if (!meta && S.t3 !== 'recovery') {
    const confirm = !!S.pin1;
    if (textMode()) return `<div class="lock">${pwScreen('create')}${P.isDesktop ? '' : `<button class="linkbtn" data-act="pin-text">Dùng bàn phím số</button>`}</div>`;
    return `<div class="lock"><h2>${confirm ? 'Nhập lại ' + PW() : 'Tạo ' + PW()}</h2>
      <p>${confirm ? 'Nhập lại lần nữa để chắc chắn.' : textMode() ? 'Đặt mật khẩu (ít nhất 4 ký tự, được dùng cả chữ và số) để bảo vệ Tab Đỏ.' : 'Đặt 6 số để bảo vệ Tab Đỏ. Từ lần sau chỉ cần vân tay, PIN dùng khi vân tay không được.'}</p>
      ${!DB.currentUser() && DB.hasFirebase ? `<p style="color:var(--red)">Nên đăng nhập (Cài đặt) trước khi tạo ${PW()} để két dùng chung trên mọi máy.</p>` : ''}
      ${pinUI(confirm ? 'Xác nhận' : 'Tiếp')}</div>`;
  }
  if (S.t3 === 'recovery') return `<div class="lock"><h2>Mã khôi phục</h2>
    <p>Chép mã này ra giấy hoặc nơi an toàn. Khi quên PIN, đây là cách <b>duy nhất</b> để mở lại Tab Đỏ.</p>
    <div class="reccode">${esc(S.recovery)}</div>
    <button class="btn" data-act="copy" data-v="${esc(S.recovery)}">${I.copy}Copy mã</button>
    <button class="btn pri" data-act="rec-done">Mình đã cất mã</button></div>`;
  if (S.t3 === 'forgot') return `<div class="lock"><h2>Quên mã PIN</h2><p>Nhập mã khôi phục (dạng XXXX-XXXX-XXXX-XXXX) đã lưu khi tạo PIN.</p>
    <input class="field" id="reccode" style="max-width:320px;width:100%;text-align:center;font-size:16px;letter-spacing:.06em" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off">
    <div class="err">${esc(S.pinErr)}</div>
    <div style="display:flex;gap:8px"><button class="btn" data-act="t3-cancel">Quay lại</button><button class="btn pri" data-act="rec-unlock">Mở khóa</button></div></div>`;
  if (S.t3 === 'newpin' && textMode()) return `<div class="lock">${pwScreen('change')}</div>`;
  if (S.t3 === 'newpin') return `<div class="lock"><h2>${S.pin1 ? 'Nhập lại ' + PW() + ' mới' : 'Đặt ' + PW() + ' mới'}</h2><p>${textMode() ? 'Ít nhất 4 ký tự, được dùng cả chữ và số.' : '6 số mới để mở Tab Đỏ.'}</p>${pinUI(S.pin1 ? 'Xác nhận' : 'Tiếp')}</div>`;
  if (!MK) {
    const canBio = S.bio && S.bioOn && pref('bioKey', false);
    if (S.t3 !== 'pin' && canBio) return `<div class="lock"><button class="fp" data-act="fp" aria-label="Mở bằng vân tay">${I.fp}</button>
      <h2>Chạm để mở bằng vân tay</h2><p>${P.isDesktop ? 'Dùng Windows Hello (vân tay hoặc khuôn mặt).' : 'Đặt ngón tay lên cảm biến vân tay.'}</p>
      <div class="err">${esc(S.pinErr)}</div><button class="linkbtn" data-act="usepin">Dùng ${PW()}</button></div>`;
    if (textMode()) return `<div class="lock">${pwScreen('unlock')}${P.isDesktop ? '' : `<button class="linkbtn" data-act="pin-text">Dùng bàn phím số</button>`}
      <div style="display:flex;gap:14px">${canBio ? `<button class="linkbtn" data-act="t3-cancel">${P.isDesktop ? 'Dùng Windows Hello' : 'Dùng vân tay'}</button>` : ''}<button class="linkbtn" data-act="forgot">Quên ${PW()}?</button></div></div>`;
    return `<div class="lock"><h2>Nhập ${PW()}</h2><p>Tab Đỏ đang khóa.</p>${pinUI('Mở khóa')}
      <div style="display:flex;gap:14px">${canBio ? `<button class="linkbtn" data-act="t3-cancel">${P.isDesktop ? 'Dùng Windows Hello' : 'Dùng vân tay'}</button>` : ''}<button class="linkbtn" data-act="forgot">Quên ${PW()}?</button></div></div>`;
  }
  // két đang mở
  const gs = groups();
  if (S.t3g && !gs.find(g => g.id === S.t3g)) S.t3g = null;
  if (!S.t3g && gs.length) S.t3g = gs[0].id;
  const g = gs.find(x => x.id === S.t3g);
  const q = S.q.trim().toLowerCase();
  const list = g ? accsOf(g.id).filter(a => !q || (a.title || '').toLowerCase().includes(q) || a.id === S.editAcc) : [];
  const hl = t => { t = t || ''; const i = q ? t.toLowerCase().indexOf(q) : -1; return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
  const card = a => {
    if (S.editAcc === a.id) return accEditor(a);
    const on = !!S.show[a.id], lines = accBody(a).split('\n');
    // hiện: mỗi cụm chữ liền nhau là 1 ô bấm để copy; ẩn: mỗi dòng thành 1 thanh mờ
    const shown = lines.map(l => l.trim() ? `<div class="ln">${l.split(/(\s+)/).map(w => w.trim() ? `<span class="tok" data-act="tok" title="Bấm để copy">${esc(w)}</span>` : esc(w)).join('')}</div>` : '<div class="ln blank"></div>').join('');
    const masked = `<div class="mask">${lines.filter(l => l.trim()).map(l => `<i style="width:${Math.min(100, 22 + l.length * 2.6)}%"></i>`).join('') || '<i style="width:30%"></i>'}<small>Nội dung đang ẩn</small></div>`;
    return `<div class="acc${enter('a' + a.id)}" data-id="${a.id}">
      <div class="acc-h"><span class="av">${esc((a.title || '?')[0].toUpperCase())}</span><b class="acc-t">${hl(a.title)}</b>
      <button class="eye" data-act="eye" data-id="${a.id}" aria-pressed="${on}" title="${on ? 'Ẩn nội dung' : 'Hiện nội dung'}" aria-label="${on ? 'Ẩn nội dung' : 'Hiện nội dung'}">${on ? I.eyeOff : I.eye}</button>
      <button class="more" data-act="acc-menu" data-id="${a.id}" title="Sửa / xóa" aria-label="Tùy chọn thẻ">${I.dots}</button></div>
      <div class="acc-b${on ? ' reveal' : ''}">${on ? (accBody(a).trim() ? shown : '<div class="ln muted">Trống</div>') : masked}</div></div>`;
  };
  const body = `<div class="dpane">
    ${S.compact ? `<div class="chips">${gs.map(x => `<button class="chip" data-act="g" data-id="${x.id}" aria-pressed="${x.id === S.t3g}">${esc(x.name)}</button>`).join('')}<button class="chip" data-act="g-new" aria-label="Thêm nhóm" title="Thêm nhóm">${I.plus14}</button>${g ? `<button class="chip" data-act="g-menu" data-id="${g.id}" aria-label="Đổi tên hoặc xóa nhóm" title="Đổi tên / xóa nhóm">${I.dots}</button>` : ''}</div>` : ''}
    ${g ? `<div class="search">${I.search}<input id="q3" placeholder="Tìm tiêu đề trong ${esc(g.name)}…" value="${esc(S.q)}" autocomplete="off"></div>
    <div class="scroll"><div class="acc-wrap">${list.length ? list.map(card).join('') : `<div class="empty">${q ? `Không có tiêu đề nào khớp "${esc(S.q)}"` : '<b>Nhóm còn trống</b>Bấm + để thêm thẻ.'}</div>`}</div></div>`
      : `<div class="empty"><b>Tạo nhóm đầu tiên</b>Ví dụ: Mạng xã hội, Công việc, Ngân hàng.<br><br><button class="btn pri" data-act="g-new">${I.plus14}Thêm nhóm</button></div>`}
  </div>`;
  if (S.compact) return `<div class="ld">${body}</div>`;
  return `<div class="ld"><div class="lpane"><div class="lhead"><b>Nhóm</b><button class="ibtn sm" data-act="g-new" title="Thêm nhóm" aria-label="Thêm nhóm">${I.plus14}</button></div>
    <div class="list">${gs.map(x => `<div class="li" data-act="g" data-id="${x.id}" aria-current="${x.id === S.t3g}"><span class="dot" style="background:var(--r-soft);color:var(--red)">${esc((x.name || '?')[0].toUpperCase())}</span><span class="nm"><b>${esc(x.name)}</b><small>${accsOf(x.id).length} thẻ</small></span><button class="more" data-act="g-menu" data-id="${x.id}" aria-label="Tùy chọn nhóm">${I.dots}</button></div>`).join('')}</div></div>${body}</div>`;
}
// nội dung thẻ: dữ liệu cũ dạng từng ô (fields) tự chuyển thành các dòng "Tên: giá trị"
const accBody = a => a.body ?? (a.fields || []).filter(f => f.k || f.v).map(f => f.k ? `${f.k}: ${f.v}` : f.v).join('\n');
function accEditor(a) {
  return `<div class="acc" data-id="${a.id}"><div class="acc-edit" id="accedit">
    <input class="field" data-ae="title" value="${esc(a.title)}" placeholder="Tiêu đề, ví dụ: Gmail công việc" style="font-weight:800">
    <textarea class="field" data-ae="body" placeholder="Nội dung: tài khoản, mật khẩu, ghi chú…" spellcheck="false">${esc(accBody(a))}</textarea>
    <div class="acts">${S.t3new ? '' : `<button class="btn ghost danger" data-act="acc-del" data-id="${a.id}">Xóa</button>`}<span class="sp"></span><button class="btn" data-act="ae-cancel">Hủy</button><button class="btn pri" data-act="ae-save">Lưu</button></div>
  </div></div>`;
}

// ---------- hộp thoại ----------
function dialog() {
  if (!S.dlg) return '';
  if (S.dlg.type === 'upd-ready') return `<div class="ov"><div class="dlg upd-dlg" role="dialog" aria-label="Bản cập nhật đã sẵn sàng">
    <div class="upd-ic">${I.refresh}</div><h2><span>Bản ${esc(S.updVersion || 'mới')} đã tải xong</span></h2>
    <p>Bấm "Cài ngay" để Mon TriNote tự đóng, cài bản mới rồi mở lại. Ghi chú của bạn đã được lưu, không mất gì.</p>
    <div class="acts"><button class="btn" data-act="dlg-close">Để sau</button><button class="btn pri" data-act="upd-restart">Cài ngay</button></div></div></div>`;
  if (S.dlg.type === 'img') return `<div class="ov lightbox" data-act="ov-img"><img src="${S.dlg.src}" alt=""></div>`;
  if (S.dlg.type === 'confirm') return `<div class="ov" data-act="ov"><div class="dlg" role="dialog"><h2><span>${esc(S.dlg.title)}</span></h2><p>${esc(S.dlg.text)}</p>
    <div class="acts"><button class="btn" data-act="dlg-close">Hủy</button><button class="btn pri" data-act="dlg-ok">${esc(S.dlg.ok || 'Xóa')}</button></div></div></div>`;
  if (S.dlg.type === 'prompt') return `<div class="ov" data-act="ov"><div class="dlg" role="dialog"><h2><span>${esc(S.dlg.title)}</span></h2>
    <input class="field" id="dlgin" value="${esc(S.dlg.value || '')}" placeholder="${esc(S.dlg.ph || '')}" style="width:100%;margin-bottom:14px" enterkeyhint="done">
    <div class="acts"><button class="btn" data-act="dlg-close">Hủy</button><button class="btn pri" data-act="dlg-ok">${esc(S.dlg.ok || 'Lưu')}</button></div></div></div>`;
  return settings();
}
function settings() {
  const u = S.upd, user = DB.currentUser(), L = S.login;
  const updTxt = { checking: 'Đang kiểm tra…', latest: 'Bạn đang dùng bản mới nhất', available: `Có bản mới ${u.version || ''}`, progress: `Đang tải ${u.percent || 0}%`, downloaded: P.isDesktop ? 'Đã tải xong, khởi động lại để cài' : 'Đang mở trình cài đặt', error: 'Lỗi: ' + (u.message || '') }[u.ev] || 'Kiểm tra trên GitHub Releases';
  const acct = !DB.hasFirebase ? `<div class="row"><div class="t"><b>Chưa bật đồng bộ</b><small>Đang lưu trên máy này.</small></div></div>`
    : user ? `<div class="row"><div class="t"><b>${esc(user.email)}</b><small>${esc(SYNC_TXT(DB.syncState.status))}</small></div><button class="btn ghost" data-act="signout">Đăng xuất</button></div>`
    : `<div class="login"><input class="field" id="lg-email" type="email" placeholder="Email" value="${esc(L.email)}" autocomplete="username">
       <input class="field" id="lg-pass" type="password" placeholder="Mật khẩu (ít nhất 6 ký tự)" autocomplete="current-password">
       <div class="acts"><button class="btn pri" data-act="signin" ${L.busy ? 'disabled' : ''}>Đăng nhập</button><button class="btn" data-act="signup" ${L.busy ? 'disabled' : ''}>Tạo tài khoản</button><button class="linkbtn" data-act="resetpass">Quên mật khẩu</button></div>
       <div class="msg ${L.err ? 'err' : 'ok'}">${esc(L.msg)}</div></div>`;
  return `<div class="ov" data-act="ov"><div class="dlg" role="dialog" aria-label="Cài đặt">
    <h2><span>Cài đặt</span><button class="ibtn" data-act="dlg-close" aria-label="Đóng">${I.x}</button></h2>
    <div class="grp"><div class="row"><div class="t"><b>Giao diện</b><small>Tông màu của app</small></div>
      <div class="tseg"><button data-act="theme" data-v="dark" aria-pressed="${S.theme === 'dark'}">${I.moon}Dark</button><button data-act="theme" data-v="light" aria-pressed="${S.theme === 'light'}">${I.sun}Light</button></div></div></div>
    <div class="grp-t">Tài khoản đồng bộ</div><div class="grp">${acct}</div>
    <div class="grp-t">Bảo mật Tab Đỏ</div><div class="grp">
      <div class="row"><div class="t"><b>Mở bằng vân tay</b><small>${S.bio ? (P.isDesktop ? 'Windows Hello' : 'Cảm biến vân tay') : 'Máy này không có cảm biến, sẽ hỏi PIN'}</small></div><button class="sw" role="switch" aria-checked="${S.bio && S.bioOn}" data-act="bio-tog" ${S.bio ? '' : 'disabled'} aria-label="Mở bằng vân tay"></button></div>
      ${P.isDesktop ? `<div class="row"><div class="t"><b>Tự khóa khi chuyển sang app khác</b><small>Tắt: chỉ khóa khi đóng hẳn app hoặc bấm nút khóa</small></div><button class="sw" role="switch" aria-checked="${pref('pcAutoLock', false)}" data-act="autolock-tog" aria-label="Tự khóa"></button></div>`
        : `<div class="row"><div class="t"><b>Tự khóa lại</b><small>Khi chuyển sang app khác, hoặc sau 1 phút rời Tab Đỏ</small></div></div>`}
      ${MK ? `<div class="row"><div class="t"><b>Khóa Tab Đỏ ngay</b><small>Phím tắt Ctrl+L</small></div><button class="btn ghost" data-act="lock-now">Khóa</button></div>` : ''}
      <div class="row"><div class="t"><b>Đổi ${PW()}</b><small>${MK ? 'Cần két đang mở' : 'Mở Tab Đỏ trước rồi đổi'}</small></div><button class="btn ghost" data-act="chpin" ${MK ? '' : 'disabled'}>Đổi</button></div></div>
    <div class="grp-t">Dữ liệu mẫu</div><div class="grp"><div class="row"><div class="t"><b>Thêm dữ liệu mẫu</b><small>Sticker, ghi chú phần mềm${MK ? ' và tài khoản giả ở Tab Đỏ' : '. Mở Tab Đỏ trước nếu muốn thêm cả tài khoản giả'}</small></div><button class="btn ghost" data-act="sample">Thêm</button></div></div>
    <div class="grp-t">Phiên bản</div><div class="grp"><div class="row"><div class="t"><b>Mon TriNote ${esc(S.version)} · ${P.platformName}</b><small>${esc(updTxt)}</small></div>
      ${u.ev === 'available' ? `<button class="btn pri" data-act="upd-install">Cập nhật</button>` : `<button class="btn pri" data-act="upd-check" ${u.ev === 'checking' || u.ev === 'progress' ? 'disabled' : ''}>${u.ev === 'checking' ? '<span class="spin"></span>' : ''}Kiểm tra bản cập nhật</button>`}</div></div>
    <div class="credit" style="text-align:center;margin-top:6px">Created by Mondiro</div>
  </div></div>`;
}

// ---------------- toast / popover ----------------
let toastT;
function toast(msg) {
  app.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; app.appendChild(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2200);
}
function popover(anchor, html, onClick) {
  closePop();
  const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; app.appendChild(p);
  const r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw)) + 'px';
  p.style.top = (r.bottom + ph + 8 > window.innerHeight ? r.top - ph - 6 : r.bottom + 6) + 'px';
  p.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { closePop(); onClick(b.dataset); } });
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
}
const outside = e => { if (!e.target.closest('.pop')) closePop(); };
function closePop() { app.querySelectorAll('.pop').forEach(p => p.remove()); document.removeEventListener('pointerdown', outside, true); }
async function copy(text) {
  const label = text.length > 30 ? text.slice(0, 30) + '…' : text;
  try { await navigator.clipboard.writeText(text); toast('Đã copy: ' + label); return; } catch {}
  // dự phòng cho webview không cho dùng clipboard API
  const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
  const ok = document.execCommand('copy'); t.remove(); toast(ok ? 'Đã copy: ' + label : 'Không copy được');
}
const confirmDlg = (title, text, ok, fn) => { S.dlg = { type: 'confirm', title, text, ok, fn }; render(true); };
const promptDlg = (title, value, ph, fn) => { S.dlg = { type: 'prompt', title, value, ph, fn }; render(true); setTimeout(() => { const i = document.getElementById('dlgin'); i && (i.focus(), i.select()); }, 50); };

// ---------------- Tab 1 actions ----------------
function stkNew() {
  const g = (DB.get('meta', 'gio') || {}).order;
  const order = Math.max(0, ...stickers().map(s => s.order ?? 0), Number.isFinite(g) ? g : 0) + 1;
  const s = DB.put('stickers', { id: DB.uid(), title: '', color: STK_COLORS[stickers().length % 5], order, items: [] });
  render(true);
  const t = app.querySelector(`.stk-t[data-s="${s.id}"]`); t && t.focus();
}
let quiet = false;
function stkUpdate(id, fn, silent) { const s = DB.get('stickers', id); if (!s) return; const n = structuredClone(s); fn(n); quiet = !!silent; DB.put('stickers', n); quiet = false; }

// ---------------- Tab 3 actions ----------------
async function pinKey(k) {
  if (k === '⌫') { S.pin = S.pin.slice(0, -1); S.pinErr = ''; return render(true); }
  if (S.pin.length >= 6) return;
  S.pin += k; S.pinErr = ''; render(true);
  if (S.pin.length < 6) return;
  return usePin(S.pin);
}
async function usePin(pin) {
  const meta = secMeta();
  if (!meta || S.t3 === 'newpin') {
    if (!S.pin1) {
      if (textMode() && pin.length < 4) { S.pinErr = 'Mật khẩu cần ít nhất 4 ký tự'; return render(true); }
      S.pin1 = pin; S.pin = ''; S.pinErr = ''; return render(true);
    }
    if (S.pin1 !== pin) { S.pin1 = ''; S.pin = ''; S.pinErr = 'Hai lần nhập không khớp, tạo lại nhé'; return render(true); }
    S.pin1 = ''; S.pin = '';
    if (!meta) {
      const v = await C.createVault(pin);
      DB.put('meta', { id: 'sec', ...v.meta });
      await setUnlocked(v.mk, v.mkB64, v.meta.keyId, true);
      S.recovery = v.recovery; S.t3 = 'recovery';
    } else {
      DB.put('meta', { id: 'sec', ...(await C.rewrapPin(meta, MKB64, pin)) });
      S.t3 = 'open'; toast('Đã đổi ' + PW());
    }
    return render(true);
  }
  try {
    const r = await C.unlockWithPin(meta, pin);
    await setUnlocked(r.mk, r.mkB64, meta.keyId, true);
    S.pinErr = '';
    const lk = app.querySelector('.lock');
    if (lk && !matchMedia('(prefers-reduced-motion: reduce)').matches) await lk.animate([{ opacity: 1 }, { opacity: 0, translate: '0 -14px' }], { duration: 450, easing: EASE }).finished.catch(() => {});
    S.pin = ''; S.t3 = 'open';
  } catch { S.pin = ''; S.pinErr = 'Sai ' + PW(); }
  render(true);
}
async function setUnlocked(mk, b64, keyId, saveForBio) {
  MK = mk; MKB64 = b64; MKID = keyId;
  if (saveForBio && S.bio && S.bioOn && await P.keySave(b64)) setPref('bioKey', true);
  await refreshVault();
}
function lockVault() { MK = null; MKB64 = null; MKID = null; vaultCache = []; S.t3 = 'lock'; S.pin = ''; S.pinErr = ''; S.editAcc = null; S.show = {}; S.q = ''; }
async function bioUnlock() {
  const meta = secMeta(); if (!meta || bioBusy) return;
  bioBusy = true;
  const ok = await P.bioVerify('Mở khóa Tab Đỏ');
  bioBusy = false; bioEndAt = Date.now();
  if (!ok) { S.pinErr = 'Chưa xác thực được, thử lại hoặc dùng PIN'; return render(true); }
  const b64 = await P.keyLoad();
  if (!b64) { setPref('bioKey', false); S.t3 = 'pin'; S.pinErr = 'Cần nhập PIN một lần trên máy này'; return render(true); }
  try {
    const mk = await C.mkFromB64(b64);
    await setUnlocked(mk, b64, meta.keyId, false);
    S.t3 = 'open'; S.pinErr = '';
  } catch { S.t3 = 'pin'; S.pinErr = 'Hãy nhập PIN'; }
  render(true);
}
function collectAccEditor() {
  const box = document.getElementById('accedit'); if (!box) return null;
  const a = vaultCache.find(v => v.id === S.editAcc) || S.newAcc;
  const { fields, ...rest } = a;
  return { ...rest, title: box.querySelector('[data-ae="title"]').value.trim(), body: box.querySelector('[data-ae="body"]').value };
}

// ---------------- sự kiện ----------------
app.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const a = el.dataset.act, d = el.dataset;
  if (a === 'ov' && e.target !== el) return;
  switch (a) {
    case 'tab': {
      const t = +d.t; if (S.tab === 3 && t !== 3) leftTab3At = Date.now();
      if (t === 3 && S.tab !== 3 && MK && autoLock() && leftTab3At && Date.now() - leftTab3At > 60000) lockVault();
      if (t === 3 && S.tab !== 3) S.show = {};
      S.tab = t; setPref('tab', t);
      if (t === 3 && !MK && secMeta() && S.t3 === 'lock' && S.bio && S.bioOn && pref('bioKey', false)) { render(true); return bioUnlock(); }
      break;
    }
    case 'settings': S.dlg = { type: 'settings' }; break;
    case 'sync-info': { const u = DB.currentUser(); toast(SYNC_TXT(DB.syncState.status) + (u ? ' · ' + u.email : '')); return; }
    case 'ov': case 'dlg-close': case 'ov-img': S.dlg = null; break;
    case 'dlg-ok': { const dl = S.dlg; S.dlg = null; const v = document.getElementById('dlgin'); dl.fn(v ? v.value.trim() : true); break; }
    case 'theme': S.theme = d.v; setPref('theme', d.v); break;
    case 'upd-check': S.updManual = true; P.checkUpdate(); return;
    case 'upd-install': S.updManual = true; P.installUpdate(); return;
    case 'upd-restart': P.restartToUpdate(); return;
    case 'copy': copy(d.v); return;
    // tab 1
    case 'stk-new': stkNew(); return;
    case 'it-chk': {
      const r = el.closest('.it'), sid = r.dataset.s, iid = r.dataset.i;
      stkUpdate(sid, s => { const it = s.items.find(x => x.id === iid); it.done = !it.done; it.doneAt = it.done ? Date.now() : 0; }, true);
      // đợi dấu tick hiện xong rồi trượt mục xuống "Đã xong"
      setTimeout(() => flip('.stk', x => x.dataset.s || 'gio', () => flip('.stk[data-s="' + sid + '"] .it', x => x.dataset.i, () => render(true))), 220);
      return;
    }
    case 'done-tog': { const sid = d.s; S.doneOpen[sid] = !S.doneOpen[sid]; setPref('doneOpen', S.doneOpen); flip('.stk', x => x.dataset.s || 'gio', () => render(true)); return; }
    case 'it-del': { const r = el.closest('.it'); stkUpdate(r.dataset.s, s => { s.items = s.items.filter(x => x.id !== r.dataset.i); }); break; }
    case 'clr': { const sid = d.s; stkUpdate(sid, s => { s.items = s.items.filter(x => !x.done); }, true); flip('.stk', x => x.dataset.s || 'gio', () => render(true)); toast('Đã xóa các mục đã xong'); return; }
    case 'stk-menu': {
      const s = DB.get('stickers', d.s);
      popover(el, `<div class="sw">${STK_COLORS.map(c => `<button data-c="${c}" aria-pressed="${s.color === c}" style="background:var(--st-${c})" aria-label="Màu"></button>`).join('')}</div><button class="mi danger" data-del="1">${I.trash}Xóa sticker</button>`,
        o => { if (o.c) stkUpdate(d.s, n => { n.color = o.c; }); if (o.del) return confirmDlg('Xóa sticker?', `"${s.title || 'Sticker'}" và tất cả mục bên trong sẽ bị xóa trên mọi máy.`, 'Xóa', () => { DB.remove('stickers', d.s); render(true); }); render(true); });
      return;
    }
    // tab 2
    case 'sort': S.t2sort = d.v; setPref('t2sort', d.v); break;
    case 'note-new': S.t2new = true; S.t2open = false; render(true); document.getElementById('newnote')?.focus(); return;
    case 'note-add': addNote(); return;
    case 'note-pick': S.t2sel = d.id; S.t2open = true; break;
    case 'back2': S.t2open = false; break;
    case 'note-menu': {
      const n = DB.get('notes', S.t2sel);
      popover(el, `<button class="mi danger" data-del="1">${I.trash}Xóa "${esc(n.name)}"</button>`, () => confirmDlg('Xóa ghi chú?', `Ghi chú "${n.name}" sẽ bị xóa trên mọi máy.`, 'Xóa', () => { (n.body || '').replace(/data-img="([^"]+)"/g, (_, id) => IMG.remove(id)); DB.remove('notes', n.id); S.t2sel = null; S.t2open = false; render(true); }));
      return;
    }
    // tab 3
    case 'pin': pinKey(d.k); return;
    case 'pin-text': S.pinText = !S.pinText; S.pin = ''; S.pinErr = ''; break;
    case 'fp': bioUnlock(); return;
    case 'usepin': S.t3 = 'pin'; S.pinErr = ''; break;
    case 'forgot': S.t3 = 'forgot'; S.pinErr = ''; break;
    case 't3-cancel': S.t3 = 'lock'; S.pin = ''; S.pinErr = ''; break;
    case 'rec-done': S.recovery = ''; S.t3 = 'open'; break;
    case 'rec-unlock': {
      const meta = secMeta(), code = document.getElementById('reccode').value;
      try { const r = await C.unlockWithRecovery(meta, code); await setUnlocked(r.mk, r.mkB64, meta.keyId, true); S.t3 = 'newpin'; S.recovered = true; S.pin = ''; S.pin1 = ''; S.pinErr = ''; }
      catch { S.pinErr = 'Mã khôi phục không đúng'; }
      break;
    }
    case 'lock': case 'lock-now': S.dlg = null; lockVault(); toast('Đã khóa Tab Đỏ'); break;
    case 'sample': {
      // không thêm trùng nếu đã có mục cùng tên
      const hasS = new Set(stickers().map(x => x.title)), hasN = new Set(DB.all('notes').map(x => x.name));
      sampleStickers().filter(x => !hasS.has(x.title)).forEach(x => DB.put('stickers', x));
      sampleNotes().filter(x => !hasN.has(x.name)).forEach(x => DB.put('notes', x));
      if (MK && !groups().some(g => g.name.endsWith('(mẫu)'))) for (const v of sampleVault()) await saveVault(v);
      S.dlg = null; toast(MK ? 'Đã thêm dữ liệu mẫu vào cả 3 tab' : 'Đã thêm mẫu vào Tab Xanh lá và Xanh dương'); break;
    }
    case 'chpin': S.dlg = null; S.tab = 3; S.t3 = 'newpin'; S.recovered = false; S.pin = ''; S.pin1 = ''; S.pinErr = ''; break;
    case 't3-cancel-change': S.t3 = MK ? 'open' : 'lock'; S.pinErr = ''; break;
    case 'autolock-tog': setPref('pcAutoLock', !pref('pcAutoLock', false)); break;
    case 'bio-tog': S.bioOn = !S.bioOn; setPref('bio', S.bioOn); if (!S.bioOn) { await P.keyClear(); setPref('bioKey', false); } else if (MKB64 && await P.keySave(MKB64)) setPref('bioKey', true); break;
    case 'g': S.t3g = d.id; S.q = ''; S.editAcc = null; break;
    case 'g-new': promptDlg('Nhóm mới', '', 'Ví dụ: Mạng xã hội', async v => { if (!v) return; const id = DB.uid(); await saveVault({ id, kind: 'group', name: v, order: groups().length }); S.t3g = id; render(true); }); return;
    case 'g-menu': {
      e.stopPropagation(); const g = vaultCache.find(x => x.id === d.id);
      popover(el, `<button class="mi" data-r="1">${I.pen}Đổi tên</button><button class="mi danger" data-del="1">${I.trash}Xóa nhóm</button>`, o => {
        if (o.r) promptDlg('Đổi tên nhóm', g.name, '', async v => { if (v) { await saveVault({ ...g, name: v }); render(true); } });
        if (o.del) confirmDlg('Xóa nhóm?', `Nhóm "${g.name}" và ${accsOf(g.id).length} tài khoản bên trong sẽ bị xóa trên mọi máy.`, 'Xóa', () => { accsOf(g.id).forEach(x => deleteVault(x.id)); deleteVault(g.id); render(true); });
      });
      return;
    }
    case 'eye': S.show[d.id] = !S.show[d.id]; break;
    case 'tok': { el.classList.remove('copied'); void el.offsetWidth; el.classList.add('copied'); copy(el.textContent); return; }
    case 'acc-new': S.newAcc = { id: DB.uid(), kind: 'acc', groupId: S.t3g, title: '', order: accsOf(S.t3g).length, body: '' };
      vaultCache.push(S.newAcc); S.editAcc = S.newAcc.id; S.t3new = true; S.q = ''; render(true); app.querySelector('[data-ae="title"]')?.focus(); return;
    case 'acc-menu': {
      const ac = vaultCache.find(x => x.id === d.id);
      const others = groups().filter(g => g.id !== ac.groupId);
      popover(el, `<button class="mi" data-ed="1">${I.pen}Sửa</button>${others.length ? `<button class="mi" data-mv="1">${I.move}Chuyển sang nhóm…</button>` : ''}<button class="mi danger" data-del="1">${I.trash}Xóa thẻ</button>`, o => {
        if (o.mv) return setTimeout(() => popover(el, `<div class="pop-t">Chuyển "${esc(ac.title)}" sang</div>${others.map(g => `<button class="mi" data-g="${g.id}">${esc(g.name)}</button>`).join('')}`, o2 => o2.g && moveAcc(d.id, o2.g)));
        if (o.ed) { S.editAcc = d.id; S.t3new = false; render(true); app.querySelector('#accedit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        if (o.del) confirmDlg('Xóa thẻ?', `"${ac.title}" sẽ bị xóa trên mọi máy.`, 'Xóa', () => { deleteVault(d.id); render(true); toast('Đã xóa'); });
      });
      return;
    }
    case 'ae-cancel': if (S.t3new) vaultCache = vaultCache.filter(v => v.id !== S.editAcc); S.editAcc = null; S.t3new = false; await refreshVault(); break;
    case 'ae-save': { const n = collectAccEditor(); if (!n.title) n.title = 'Không tên'; await saveVault(n); S.editAcc = null; S.t3new = false; S.newAcc = null; S.show[n.id] = false; toast('Đã lưu, nội dung đã ẩn'); break; }
    case 'acc-del': { const ac = vaultCache.find(x => x.id === d.id); confirmDlg('Xóa tài khoản?', `"${ac.title}" sẽ bị xóa trên mọi máy.`, 'Xóa', () => { deleteVault(d.id); S.editAcc = null; render(true); }); return; }
    // tài khoản đồng bộ
    case 'signin': case 'signup': case 'resetpass': {
      const email = document.getElementById('lg-email').value.trim(), pass = document.getElementById('lg-pass').value;
      S.login = { email, busy: true, msg: 'Đang xử lý…', err: false }; render(true);
      try {
        if (a === 'signin') await DB.signIn(email, pass);
        else if (a === 'signup') await DB.signUp(email, pass);
        else { await DB.resetPass(email); S.login = { email, busy: false, msg: 'Đã gửi email đặt lại mật khẩu', err: false }; return render(true); }
        S.login = { email: '', busy: false, msg: '', err: false }; toast('Đã đăng nhập, đang đồng bộ');
      } catch (er) { S.login = { email, busy: false, msg: er.message, err: true }; }
      break;
    }
    case 'signout': await DB.signOutUser(); lockVault(); toast('Đã đăng xuất'); break;
    default: return;
  }
  render(true);
});

function addNote() {
  const i = document.getElementById('newnote'), name = (i && i.value.trim()) || '';
  S.t2new = false;
  if (name) {
    const order = Math.min(0, ...DB.all('notes').map(n => n.order ?? 0)) - 1;
    const n = DB.put('notes', { id: DB.uid(), name, body: '', order, editedAt: Date.now() });
    S.t2sel = n.id; S.t2open = true;
  }
  render(true);
}

app.addEventListener('click', e => {
  const b = e.target.closest('[data-eye]'); if (!b) return;
  const i = b.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; i.focus();
});
// mật khẩu chữ (PC): tạo mới / đổi
async function submitNewPw(kind, old, a, b) {
  const meta = secMeta();
  if (!a) { S.pinErr = 'Hãy nhập mật khẩu mới'; return render(true); }
  if (a !== b) { S.pinErr = 'Hai lần nhập không khớp'; return render(true); }
  if (kind === 'change' && meta && !S.recovered) {
    try { await C.unlockWithPin(meta, old); } catch { S.pinErr = 'Mật khẩu cũ không đúng'; return render(true); }
  }
  S.pinErr = '';
  if (!meta) {
    const v = await C.createVault(a);
    DB.put('meta', { id: 'sec', ...v.meta });
    await setUnlocked(v.mk, v.mkB64, v.meta.keyId, true);
    S.recovery = v.recovery; S.t3 = 'recovery';
  } else {
    DB.put('meta', { id: 'sec', ...(await C.rewrapPin(meta, MKB64, a)) });
    S.recovered = false; S.t3 = 'open'; toast('Đã đổi mật khẩu');
  }
  render(true);
}
app.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target.dataset.form, v = id => (document.getElementById(id) || {}).value || '';
  if (f === 'unlock') { if (v('pw')) usePin(v('pw')); }
  if (f === 'create' || f === 'change') submitNewPw(f, v('pwold'), v('pw'), v('pw2'));
});
// gõ chữ: lưu ngay, không vẽ lại để không mất con trỏ
const saveTimers = {};
const debounce = (k, fn, ms = 500) => { clearTimeout(saveTimers[k]); saveTimers[k] = setTimeout(fn, ms); };
app.addEventListener('input', e => {
  const t = e.target, kind = t.dataset.edit;
  if (t.id === 'q3') { S.q = t.value; const pos = t.selectionStart; render(true); const q = document.getElementById('q3'); q.focus(); q.setSelectionRange(pos, pos); return; }
  if (kind === 'stk-title') debounce('st' + t.dataset.s, () => stkUpdate(t.dataset.s, s => { s.title = t.textContent.trim(); }));
  if (kind === 'it') { const r = t.closest('.it'); debounce('it' + r.dataset.i, () => stkUpdate(r.dataset.s, s => { const it = s.items.find(x => x.id === r.dataset.i); if (it) it.text = t.textContent; })); }
  if (kind === 'note-name') { const id = S.t2sel; debounce('nn' + id, () => { const n = DB.get('notes', id); n && DB.put('notes', { ...n, name: t.textContent.trim() || 'Không tên', editedAt: Date.now() }); }); }
  if (kind === 'note-body') { const id = S.t2sel; debounce('nb' + id, () => saveNoteBody(id, t), 700); }
});
app.addEventListener('keydown', e => {
  const t = e.target;
  if (t.dataset.add && e.key === 'Enter' && t.value.trim()) {
    const sid = t.dataset.add, text = t.value.trim();
    stkUpdate(sid, s => { s.items = [...(s.items || []), { id: DB.uid(), text, done: false }]; });
    render(true); app.querySelector(`[data-add="${sid}"]`)?.focus(); return;
  }
  if ((t.dataset.edit === 'stk-title' || t.dataset.edit === 'it' || t.dataset.edit === 'note-name') && e.key === 'Enter') { e.preventDefault(); t.blur(); }
  if (t.id === 'newnote' && e.key === 'Enter') addNote();
  if (t.id === 'newnote' && e.key === 'Escape') { S.t2new = false; render(true); }
  if (t.id === 'dlgin' && e.key === 'Enter') app.querySelector('[data-act="dlg-ok"]').click();
  if (t.id === 'reccode' && e.key === 'Enter') app.querySelector('[data-act="rec-unlock"]').click();
  if ((t.id === 'lg-pass' || t.id === 'lg-email') && e.key === 'Enter') app.querySelector('[data-act="signin"]').click();
});
app.addEventListener('focusout', e => {
  const t = e.target;
  // xóa mục trống khi rời ô
  if (t.dataset.edit === 'it' && !t.textContent.trim()) { const r = t.closest('.it'); stkUpdate(r.dataset.s, s => { s.items = s.items.filter(x => x.id !== r.dataset.i); }); }
  setTimeout(() => { if (pendingRender && !editing()) render(true); }, 750);
});
// dán chữ thường vào ghi chú (bỏ định dạng web lạ)
app.addEventListener('paste', e => {
  const t = e.target.closest('[data-edit]'); if (!t) return;
  if (t.dataset.edit === 'note-body') return pasteRich(e, t);
  e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
});

// phím tắt
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.dlg) { S.dlg = null; render(true); } closePop(); return; }
  if (S.tab === 3 && !MK && !textMode() && /^[0-9]$/.test(e.key) && !editing() && !S.dlg && S.t3 !== 'forgot') { pinKey(e.key); return; }
  if (S.tab === 3 && !MK && !textMode() && e.key === 'Backspace' && !editing() && !S.dlg) { pinKey('⌫'); return; }
  if (!(e.ctrlKey || e.metaKey)) return;
  if (['1', '2', '3'].includes(e.key)) { e.preventDefault(); app.querySelector(`.tabbtn[data-t="${e.key}"]`)?.click(); }
  if (e.key === ',') { e.preventDefault(); S.dlg = { type: 'settings' }; render(true); }
  if (e.key.toLowerCase() === 'n' && !editing()) { e.preventDefault(); if (S.tab === 1) stkNew(); else if (S.tab === 2) app.querySelector('[data-act="note-new"]')?.click(); else app.querySelector('[data-act="acc-new"]')?.click(); }
  if (e.key.toLowerCase() === 'l' && S.tab === 3 && MK) { e.preventDefault(); lockVault(); render(true); }
});

// ---------------- giữ (hold) rồi kéo để sắp xếp lại ----------------
// Dùng cho sticker (Tab Xanh lá, kể cả sticker Đám giỗ má) và danh sách phần mềm (Tab Xanh dương).
// Khi kéo qua, các mục khác tự trượt nhường chỗ; thả ra là lưu thứ tự mới.
const HOLD_MS = 320;
let hold = null, drag = null, eatClick = false;
const SORTS = [
  { item: '.stk', box: '.wall', key: el => el.dataset.s || 'gio', ok: () => S.tab === 1, save: ids => saveStickerOrder(ids) },
  { item: '.acc[data-id]', box: '.acc-wrap', key: el => el.dataset.id, ok: () => S.tab === 3 && !!MK && !S.editAcc && !S.q, save: ids => saveAccOrder(ids) },
  { item: '.li[data-act="note-pick"]', box: '.list', key: el => el.dataset.id, ok: () => S.tab === 2, save: ids => saveNoteOrder(ids), list: true },
  { item: '.li[data-act="g"]', box: '.list', key: el => el.dataset.id, ok: () => S.tab === 3 && !!MK, save: ids => saveGroupOrder(ids), list: true }
];
app.addEventListener('pointerdown', e => {
  if (e.button > 0 || e.target.closest('input,button,.pop,.ov')) return;
  for (const cfg of SORTS) {
    const el = e.target.closest(cfg.item);
    // PC + danh sách tab con: nhấn giữ chuột rồi kéo là đi luôn (m-skill: di chuột > 4px); còn lại: giữ ~0.3s
    if (el && cfg.ok()) { const quick = cfg.list && e.pointerType === 'mouse'; hold = { cfg, el, quick, x: e.clientX, y: e.clientY, t: quick ? 0 : setTimeout(startDrag, HOLD_MS) }; return; }
  }
});
function cancelHold() { if (hold) { clearTimeout(hold.t); hold = null; } }
function startDrag() {
  if (!hold) return;
  const { cfg, el, x, y } = hold; hold = null;
  document.activeElement && document.activeElement.blur();
  getSelection()?.removeAllRanges();
  const r = el.getBoundingClientRect();
  drag = { cfg, el, box: el.closest(cfg.box), offX: x - r.left, offY: y - r.top, px: x, py: y, last: null, scroller: el.closest('.scroll,.list') };
  el.classList.add('lift'); app.classList.add('dragging-stk');
  try { navigator.vibrate?.(12); } catch {}
}
// đặt mục đang kéo dưới ngón tay/chuột, tính theo vị trí thật của nó trong bố cục
function follow() {
  const el = drag.el; el.style.translate = '0 0';
  const r = el.getBoundingClientRect();
  // điện thoại / danh sách 1 cột: chỉ kéo lên xuống
  const dx = S.compact || drag.cfg.box === '.list' ? 0 : drag.px - drag.offX - r.left;
  el.style.translate = `${dx}px ${drag.py - drag.offY - r.top}px`;
}
window.addEventListener('pointermove', e => {
  if (hold) { const dist = Math.hypot(e.clientX - hold.x, e.clientY - hold.y); if (hold.quick) { if (dist > 4) startDrag(); } else if (dist > 8) cancelHold(); }
  if (!drag) return;
  e.preventDefault();
  drag.px = e.clientX; drag.py = e.clientY;
  const sc = drag.scroller, sr = sc && sc.getBoundingClientRect();
  if (sr) { if (e.clientY < sr.top + 50) sc.scrollTop -= 12; else if (e.clientY > sr.bottom - 50) sc.scrollTop += 12; }
  // màn 1 cột: dò theo trục dọc ở giữa cột để kéo lệch ngang vẫn nhận đúng chỗ
  const vertical = S.compact || drag.cfg.box === '.list';
  const bx = vertical ? drag.box.getBoundingClientRect().left + drag.box.clientWidth / 2 : e.clientX;
  const over = document.elementFromPoint(bx, e.clientY)?.closest(drag.cfg.item);
  if (over && over !== drag.el && over !== drag.last && drag.box.contains(over)) {
    drag.last = over;
    const sibs = [...drag.box.querySelectorAll(drag.cfg.item)];
    const before = sibs.indexOf(drag.el) > sibs.indexOf(over);
    // các mục còn lại trượt nhường chỗ
    const first = new Map(sibs.filter(x => x !== drag.el).map(x => [x, x.getBoundingClientRect()]));
    over.parentNode.insertBefore(drag.el, before ? over : over.nextSibling);
    for (const [x, f] of first) {
      const l = x.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) > .5 || Math.abs(dy) > .5) x.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 260, easing: EASE });
    }
  } else if (!over) drag.last = null;
  if (drag.cfg.item === '.acc[data-id]') {
    const g = document.elementFromPoint(e.clientX, e.clientY)?.closest('.lpane .li[data-act="g"]');
    const tg = g && g.dataset.id !== S.t3g ? g : null;
    if (tg !== drag.grp) { drag.grp?.classList.remove('drop-target'); tg?.classList.add('drop-target'); drag.grp = tg; }
  }
  follow();
}, { passive: false });
window.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
document.addEventListener('selectstart', e => { if (drag || hold) e.preventDefault(); });
app.addEventListener('contextmenu', e => { if (drag || hold) e.preventDefault(); });
function endDrag() {
  cancelHold();
  if (!drag) return;
  const { cfg, el, box, grp } = drag; drag = null; eatClick = true; setTimeout(() => { eatClick = false; }, 60);
  app.classList.remove('dragging-stk');
  if (grp) { grp.classList.remove('drop-target'); return moveAcc(el.dataset.id, grp.dataset.id); }
  const ids = [...box.querySelectorAll(cfg.item)].map(cfg.key);
  // mục đang kéo bay về chỗ mới
  const k = cfg.key(el);
  // bỏ vị trí đang kéo + vẽ lại toàn bộ danh sách, rồi FLIP từ chỗ thả về đúng ô (không để mục nằm lơ lửng)
  flip(cfg.item, cfg.key, () => { el.classList.remove('lift'); el.style.translate = ''; cfg.save(ids); parts['p-main'] = null; render(true); }, 240);
  // hạ xuống kèm pop nhẹ
  const n = [...app.querySelectorAll(cfg.item)].find(x => cfg.key(x) === k);
  n?.animate([{ scale: 1.04 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
app.addEventListener('click', e => { if (eatClick) { e.stopPropagation(); e.preventDefault(); } }, true);
function saveStickerOrder(ids) {
  quiet = true;
  ids.forEach((id, i) => {
    const order = ids.length - i;
    if (id === 'gio') { if ((DB.get('meta', 'gio') || {}).order !== order) DB.put('meta', { id: 'gio', order }); return; }
    const x = DB.get('stickers', id); if (x && x.order !== order) DB.put('stickers', { ...x, order });
  });
  quiet = false;
}
function saveAccOrder(ids) {
  // đổi thứ tự trong bộ nhớ ngay (để vẽ lại đúng), mã hóa + lưu chạy sau
  ids.forEach((id, i) => { const v = vaultCache.find(x => x.id === id); if (v && v.order !== i) { v.order = i; saveVault(v); } });
}
function saveGroupOrder(ids) {
  ids.forEach((id, i) => { const g = vaultCache.find(x => x.id === id); if (g && g.order !== i) { g.order = i; saveVault(g); } });
}
// chuyển 1 thẻ sang nhóm khác (đặt cuối nhóm mới)
function moveAcc(id, gid) {
  const a = vaultCache.find(x => x.id === id), g = vaultCache.find(x => x.id === gid);
  if (!a || !g || a.groupId === gid) return render(true);
  a.groupId = gid; a.order = accsOf(gid).length; saveVault(a);
  render(true); toast(`Đã chuyển "${a.title}" sang ${g.name}`);
}
function saveNoteOrder(ids) {
  if (S.t2sort !== 'manual') { S.t2sort = 'manual'; setPref('t2sort', 'manual'); }
  quiet = true;
  ids.forEach((id, i) => { const n = DB.get('notes', id); if (n && n.order !== i) DB.put('notes', { ...n, order: i }); });
  quiet = false;
}

// rời app (chuyển sang app khác) là khóa Tab Đỏ; quay lại Tab Đỏ thì hỏi vân tay lại
let bioBusy = false, bioEndAt = 0;
const autoLock = () => !P.isDesktop || pref('pcAutoLock', false);
function onLeaveApp() {
  if (bioBusy || !MK || !autoLock()) return;
  lockVault(); render(true);
}
function onBackToApp() {
  if (bioBusy || Date.now() - bioEndAt < 1500) return;
  if (S.tab === 3 && !MK && secMeta() && S.t3 === 'lock' && S.bio && S.bioOn && pref('bioKey', false) && !S.dlg) bioUnlock();
}
document.addEventListener('visibilitychange', () => document.hidden ? onLeaveApp() : onBackToApp());
if (P.isDesktop) { window.addEventListener('blur', onLeaveApp); window.addEventListener('focus', onBackToApp); }
window.addEventListener('resize', () => { const was = S.compact + ':' + S.wide; const w = innerWidth; if (was !== (w < 600) + ':' + (w >= 900)) render(true); });

// dữ liệu đổi từ máy khác
DB.onChange(async c => {
  if (quiet) return;
  if (c === 'meta') { const m = secMeta(); if (MK && (!m || m.keyId !== MKID)) { lockVault(); await P.keyClear(); setPref('bioKey', false); } }
  if (c === 'vault' && MK && !S.editAcc) await refreshVault();
  render();
});
DB.onAuth(u => { if (u) IMG.uploadPending(); render(true); });
// bấm đúp vào hình trong ghi chú để xem lớn
app.addEventListener('dblclick', e => { const im = e.target.closest('.editor img[src]'); if (im) { S.dlg = { type: 'img', src: im.src }; render(true); } });

// cập nhật
P.onUpdate(u => {
  if (u.version) S.updVersion = u.version;
  S.upd = { ...u, version: u.version || S.updVersion };
  // PC: tải xong → hiện bảng hỏi khởi động lại để cài
  if (u.ev === 'downloaded' && P.isDesktop) { S.dlg = { type: 'upd-ready' }; return render(true); }
  if (u.ev === 'progress' && u.percent === 0 && S.updManual) toast('Đang tải bản mới…');
  if (u.ev === 'error' && S.updManual && S.dlg?.type !== 'settings') toast('Không kiểm tra được bản cập nhật');
  render(S.dlg?.type === 'settings');
});

// khởi động
(async () => {
  S.version = await P.appVersion();
  S.bio = await P.bioAvailable();
  render(true);
  DB.initSync().catch(() => {});
  setTimeout(() => P.checkUpdate(), 3000);
})();
