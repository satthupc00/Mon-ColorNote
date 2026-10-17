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

// sanitize HTML ghi chú (chỉ giữ thẻ định dạng cơ bản)
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'H4', 'KBD', 'SPAN']);
function clean(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const walk = el => [...el.children].forEach(c => {
    if (!OK_TAGS.has(c.tagName)) { c.replaceWith(...c.childNodes); return walk(el); }
    [...c.attributes].forEach(a => c.removeAttribute(a.name)); walk(c);
  });
  const root = doc.body.firstChild; walk(root); return root.innerHTML;
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
  return MK ? `${groups().length} nhóm · ${vaultCache.filter(v => v.kind === 'acc').length} tài khoản · đã mã hóa` : 'Đã khóa';
};

function header() {
  const u = S.upd, st = DB.syncState.status, user = DB.currentUser();
  const syncTxt = { local: 'Chỉ trên máy này', offline: user ? 'Ngoại tuyến' : 'Chưa đăng nhập', syncing: 'Đang đồng bộ…', synced: 'Đã đồng bộ', error: 'Lỗi đồng bộ' }[st];
  const updBtn = u.ev === 'available' ? `<button class="updbtn" data-act="upd-install" title="Tải và cài bản mới">Có bản ${esc(u.version)} · Cập nhật</button>`
    : u.ev === 'progress' ? `<button class="updbtn" disabled>Đang tải ${u.percent || 0}%</button>`
    : u.ev === 'downloaded' && P.isDesktop ? `<button class="updbtn" data-act="upd-restart">Khởi động lại để cập nhật</button>` : '';
  return `<header class="hdr">
    <div class="brand"><img src="${iconUrl}" alt="">
      <div style="min-width:0"><div class="brand-name"><span><span class="m">Mon</span> <span class="a">TriNote</span></span>${u.ev === 'latest' ? '<span class="latest">latest</span>' : ''}</div>
      <div class="brand-desc">Ghi chú 3 màu, đồng bộ PC và điện thoại</div></div></div>
    ${updBtn}
    ${S.compact ? `<span class="sync ${st}" title="${syncTxt}"><i></i></span>` : `<span class="sync ${st}"><i></i>${syncTxt}</span>`}
    <button class="ibtn" data-act="settings" title="Cài đặt (Ctrl+,)" aria-label="Cài đặt">${I.gear}</button>
  </header>`;
}
const TAB_TIPS = ['', 'Sticker việc cần làm (Ctrl+1)', 'Ghi chú phần mềm (Ctrl+2)', 'Tài khoản bảo mật (Ctrl+3)'];
const tabs = () => [1, 2, 3].map(t => `<button class="tabbtn" data-t="${t}" data-act="tab" aria-selected="${S.tab === t}" aria-label="${TAB_TIPS[t]}" title="${TAB_TIPS[t]}">${t === 3 ? `<span class="lk">${MK ? I.unlock : I.lock}</span>` : ''}</button>`).join('');

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
      <div class="editor" contenteditable="true" spellcheck="false" data-edit="note-body">${clean(cur.body)}</div></div>`
    : `<div class="dpane"><div class="empty"><b>Chọn một phần mềm</b>Hoặc bấm + để thêm mới.</div></div>`;
  if (S.compact) return `<div class="ld">${S.t2open && cur ? dp : lp}</div>`;
  return `<div class="ld">${lp}${dp}</div>`;
}
function hue(s) { const cols = ['#F29A9C', '#86BDF0', '#F2B84B', '#7FD49B', '#B9A6F5', '#F5A6D8', '#7ED6D6']; let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return cols[h % cols.length]; }

// ---------- Tab 3 ----------
const dots = n => `<div class="pin-dots ${S.pinErr ? 'shake' : ''}">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < n ? 'f' : ''}"></i>`).join('')}</div>`;
const pad = () => `<div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'x', 0, '⌫'].map(k => k === 'x' ? '<span></span>' : `<button data-act="pin" data-k="${k}" aria-label="${k === '⌫' ? 'Xóa' : k}">${k}</button>`).join('')}</div>`;
function tab3() {
  const meta = secMeta();
  if (!meta && S.t3 !== 'recovery') {
    const confirm = !!S.pin1;
    return `<div class="lock"><h2>${confirm ? 'Nhập lại mã PIN' : 'Tạo mã PIN'}</h2>
      <p>${confirm ? 'Nhập lại 6 số vừa tạo để chắc chắn.' : 'Đặt 6 số để bảo vệ Tab Đỏ. Từ lần sau chỉ cần vân tay, PIN dùng khi vân tay không được.'}</p>
      ${!DB.currentUser() && DB.hasFirebase ? `<p style="color:var(--red)">Nên đăng nhập (Cài đặt) trước khi tạo PIN để két dùng chung trên mọi máy.</p>` : ''}
      ${dots(S.pin.length)}<div class="err">${esc(S.pinErr)}</div>${pad()}</div>`;
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
  if (S.t3 === 'newpin') return `<div class="lock"><h2>${S.pin1 ? 'Nhập lại PIN mới' : 'Đặt mã PIN mới'}</h2><p>6 số mới để mở Tab Đỏ.</p>${dots(S.pin.length)}<div class="err">${esc(S.pinErr)}</div>${pad()}</div>`;
  if (!MK) {
    const canBio = S.bio && S.bioOn && pref('bioKey', false);
    if (S.t3 !== 'pin' && canBio) return `<div class="lock"><button class="fp" data-act="fp" aria-label="Mở bằng vân tay">${I.fp}</button>
      <h2>Chạm để mở bằng vân tay</h2><p>${P.isDesktop ? 'Dùng Windows Hello (vân tay hoặc khuôn mặt).' : 'Đặt ngón tay lên cảm biến vân tay.'}</p>
      <div class="err">${esc(S.pinErr)}</div><button class="linkbtn" data-act="usepin">Dùng mã PIN</button></div>`;
    return `<div class="lock"><h2>Nhập mã PIN</h2><p>Tab Đỏ đang khóa.</p>${dots(S.pin.length)}<div class="err">${esc(S.pinErr)}</div>${pad()}
      <div style="display:flex;gap:14px">${canBio ? `<button class="linkbtn" data-act="t3-cancel">Dùng vân tay</button>` : ''}<button class="linkbtn" data-act="forgot">Quên PIN?</button></div></div>`;
  }
  // két đang mở
  const gs = groups();
  if (S.t3g && !gs.find(g => g.id === S.t3g)) S.t3g = null;
  if (!S.t3g && gs.length) S.t3g = gs[0].id;
  const g = gs.find(x => x.id === S.t3g);
  const q = S.q.trim().toLowerCase();
  const list = g ? accsOf(g.id).filter(a => !q || (a.title || '').toLowerCase().includes(q) || a.id === S.editAcc) : [];
  const hl = t => { t = t || ''; const i = q ? t.toLowerCase().indexOf(q) : -1; return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
  const card = (a, k) => {
    if (S.editAcc === a.id) return accEditor(a);
    const closed = !!S.closed[a.id];
    return `<div class="acc ${closed ? 'closed' : ''}${enter('a' + a.id)}" style="animation-delay:${Math.min(k, 8) * 50}ms" data-id="${a.id}">
      <div class="acc-h"><button class="acc-tg" data-act="tog" data-id="${a.id}" aria-expanded="${!closed}"><span class="av">${esc((a.title || '?')[0].toUpperCase())}</span><b>${hl(a.title)}</b><span class="chev">${I.chev}</span></button>
      <button class="more" data-act="acc-menu" data-id="${a.id}" title="Sửa / xóa" aria-label="Tùy chọn tài khoản">${I.dots}</button></div>
      <div class="acc-b">${(a.fields || []).map((f, fi) => { const sk = a.id + ':' + fi; return `<div class="kv"><span title="${esc(f.k)}">${esc(f.k)}</span><code>${f.secret && !S.show[sk] ? '••••••••' : esc(f.v)}</code>
        ${f.secret ? `<button data-act="eye" data-k="${sk}" title="Hiện / ẩn" aria-label="Hiện hoặc ẩn">${S.show[sk] ? I.eyeOff : I.eye}</button>` : ''}<button data-act="copy-f" data-id="${a.id}" data-f="${fi}" title="Copy" aria-label="Copy">${I.copy}</button></div>`; }).join('') || '<div class="kv"><span>Trống</span></div>'}</div></div>`;
  };
  const body = `<div class="dpane">
    ${S.compact ? `<div class="chips">${gs.map(x => `<button class="chip" data-act="g" data-id="${x.id}" aria-pressed="${x.id === S.t3g}">${esc(x.name)}</button>`).join('')}<button class="chip" data-act="g-new" aria-label="Thêm nhóm" title="Thêm nhóm">${I.plus14}</button>${g ? `<button class="chip" data-act="g-menu" data-id="${g.id}" aria-label="Đổi tên hoặc xóa nhóm" title="Đổi tên / xóa nhóm">${I.dots}</button>` : ''}<button class="chip" data-act="lock" aria-label="Khóa lại" title="Khóa lại">${I.lock16}</button></div>` : ''}
    ${g ? `<div class="search">${I.search}<input id="q3" placeholder="Tìm tiêu đề trong ${esc(g.name)}…" value="${esc(S.q)}" autocomplete="off"></div>
    <div class="scroll"><div class="acc-wrap">${list.length ? list.map(card).join('') : `<div class="empty">${q ? `Không có tiêu đề nào khớp "${esc(S.q)}"` : '<b>Nhóm còn trống</b>Bấm + để thêm tài khoản.'}</div>`}</div></div>`
      : `<div class="empty"><b>Tạo nhóm đầu tiên</b>Ví dụ: Mạng xã hội, Công việc, Ngân hàng.<br><br><button class="btn pri" data-act="g-new">${I.plus14}Thêm nhóm</button></div>`}
  </div>`;
  if (S.compact) return `<div class="ld">${body}</div>`;
  return `<div class="ld"><div class="lpane"><div class="lhead"><b>Nhóm</b><button class="ibtn sm" data-act="g-new" title="Thêm nhóm" aria-label="Thêm nhóm">${I.plus14}</button><button class="ibtn sm" data-act="lock" title="Khóa lại" aria-label="Khóa lại">${I.lock16}</button></div>
    <div class="list">${gs.map(x => `<div class="li" data-act="g" data-id="${x.id}" aria-current="${x.id === S.t3g}"><span class="dot" style="background:var(--r-soft);color:var(--red)">${esc((x.name || '?')[0].toUpperCase())}</span><span class="nm"><b>${esc(x.name)}</b><small>${accsOf(x.id).length} tài khoản</small></span><button class="more" data-act="g-menu" data-id="${x.id}" aria-label="Tùy chọn nhóm">${I.dots}</button></div>`).join('')}</div></div>${body}</div>`;
}
function accEditor(a) {
  const f = a.fields || [];
  return `<div class="acc" data-id="${a.id}"><div class="acc-edit" id="accedit">
    <input class="field" data-ae="title" value="${esc(a.title)}" placeholder="Tiêu đề, ví dụ: Gmail công việc" style="font-weight:800">
    ${f.map((x, i) => `<div class="row2" data-fi="${i}"><input class="field" data-ae="k" value="${esc(x.k)}" placeholder="Tên mục"><input class="field" data-ae="v" value="${esc(x.v)}" placeholder="Giá trị" ${x.secret ? 'type="password"' : ''}>
      <label class="sec" title="Che giá trị"><input type="checkbox" data-ae="s" ${x.secret ? 'checked' : ''}>Ẩn</label><button class="more" data-act="ae-delf" data-fi="${i}" aria-label="Xóa dòng">${I.x14}</button></div>`).join('')}
    <div class="acts"><button class="btn ghost" data-act="ae-addf">${I.plus14}Thêm dòng</button><span class="sp"></span>
      ${S.t3new ? '' : `<button class="btn ghost danger" data-act="acc-del" data-id="${a.id}">Xóa</button>`}<button class="btn" data-act="ae-cancel">Hủy</button><button class="btn pri" data-act="ae-save">Lưu</button></div>
  </div></div>`;
}

// ---------- hộp thoại ----------
function dialog() {
  if (!S.dlg) return '';
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
  const acct = !DB.hasFirebase ? `<div class="row"><div class="t"><b>Chưa kết nối Firebase</b><small>Đang lưu trên máy này. Kết nối Firebase để đồng bộ PC và điện thoại.</small></div></div>`
    : user ? `<div class="row"><div class="t"><b>${esc(user.email)}</b><small>Đồng bộ qua Firebase</small></div><button class="btn ghost" data-act="signout">Đăng xuất</button></div>`
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
      <div class="row"><div class="t"><b>Tự khóa lại</b><small>Sau 1 phút rời Tab Đỏ hoặc ẩn app</small></div></div>
      <div class="row"><div class="t"><b>Đổi mã PIN</b><small>${MK ? 'Cần két đang mở' : 'Mở Tab Đỏ trước rồi đổi'}</small></div><button class="btn ghost" data-act="chpin" ${MK ? '' : 'disabled'}>Đổi</button></div></div>
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
  try { await navigator.clipboard.writeText(text); toast('Đã copy'); }
  catch { toast('Không copy được'); }
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
  const pin = S.pin;
  const meta = secMeta();
  if (!meta || S.t3 === 'newpin') {
    if (!S.pin1) { S.pin1 = pin; S.pin = ''; return render(true); }
    if (S.pin1 !== pin) { S.pin1 = ''; S.pin = ''; S.pinErr = 'Hai lần nhập không khớp, tạo lại nhé'; return render(true); }
    S.pin1 = ''; S.pin = '';
    if (!meta) {
      const v = await C.createVault(pin);
      DB.put('meta', { id: 'sec', ...v.meta });
      await setUnlocked(v.mk, v.mkB64, v.meta.keyId, true);
      S.recovery = v.recovery; S.t3 = 'recovery';
    } else {
      DB.put('meta', { id: 'sec', ...(await C.rewrapPin(meta, MKB64, pin)) });
      S.t3 = 'open'; toast('Đã đổi mã PIN');
    }
    return render(true);
  }
  try {
    const r = await C.unlockWithPin(meta, pin);
    await setUnlocked(r.mk, r.mkB64, meta.keyId, true);
    S.pin = ''; S.t3 = 'open';
  } catch { S.pin = ''; S.pinErr = 'Sai mã PIN'; }
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
  const n = { ...a, title: box.querySelector('[data-ae="title"]').value.trim(), fields: [] };
  box.querySelectorAll('.row2').forEach(r => n.fields.push({ k: r.querySelector('[data-ae="k"]').value.trim(), v: r.querySelector('[data-ae="v"]').value, secret: r.querySelector('[data-ae="s"]').checked }));
  return n;
}

// ---------------- sự kiện ----------------
app.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const a = el.dataset.act, d = el.dataset;
  if (a === 'ov' && e.target !== el) return;
  switch (a) {
    case 'tab': {
      const t = +d.t; if (S.tab === 3 && t !== 3) leftTab3At = Date.now();
      if (t === 3 && S.tab !== 3 && MK && leftTab3At && Date.now() - leftTab3At > 60000) lockVault();
      S.tab = t; setPref('tab', t);
      if (t === 3 && !MK && secMeta() && S.t3 === 'lock' && S.bio && S.bioOn && pref('bioKey', false)) { render(true); return bioUnlock(); }
      break;
    }
    case 'settings': S.dlg = { type: 'settings' }; break;
    case 'ov': case 'dlg-close': S.dlg = null; break;
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
      popover(el, `<button class="mi danger" data-del="1">${I.trash}Xóa "${esc(n.name)}"</button>`, () => confirmDlg('Xóa ghi chú?', `Ghi chú "${n.name}" sẽ bị xóa trên mọi máy.`, 'Xóa', () => { DB.remove('notes', n.id); S.t2sel = null; S.t2open = false; render(true); }));
      return;
    }
    // tab 3
    case 'pin': pinKey(d.k); return;
    case 'fp': bioUnlock(); return;
    case 'usepin': S.t3 = 'pin'; S.pinErr = ''; break;
    case 'forgot': S.t3 = 'forgot'; S.pinErr = ''; break;
    case 't3-cancel': S.t3 = 'lock'; S.pin = ''; S.pinErr = ''; break;
    case 'rec-done': S.recovery = ''; S.t3 = 'open'; break;
    case 'rec-unlock': {
      const meta = secMeta(), code = document.getElementById('reccode').value;
      try { const r = await C.unlockWithRecovery(meta, code); await setUnlocked(r.mk, r.mkB64, meta.keyId, true); S.t3 = 'newpin'; S.pin = ''; S.pin1 = ''; S.pinErr = ''; }
      catch { S.pinErr = 'Mã khôi phục không đúng'; }
      break;
    }
    case 'lock': lockVault(); toast('Đã khóa Tab Đỏ'); break;
    case 'sample': {
      // không thêm trùng nếu đã có mục cùng tên
      const hasS = new Set(stickers().map(x => x.title)), hasN = new Set(DB.all('notes').map(x => x.name));
      sampleStickers().filter(x => !hasS.has(x.title)).forEach(x => DB.put('stickers', x));
      sampleNotes().filter(x => !hasN.has(x.name)).forEach(x => DB.put('notes', x));
      if (MK && !groups().some(g => g.name.endsWith('(mẫu)'))) for (const v of sampleVault()) await saveVault(v);
      S.dlg = null; toast(MK ? 'Đã thêm dữ liệu mẫu vào cả 3 tab' : 'Đã thêm mẫu vào Tab Xanh lá và Xanh dương'); break;
    }
    case 'chpin': S.dlg = null; S.tab = 3; S.t3 = 'newpin'; S.pin = ''; S.pin1 = ''; break;
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
    case 'tog': S.closed[d.id] = !S.closed[d.id]; setPref('closed', S.closed); break;
    case 'eye': S.show[d.k] = !S.show[d.k]; break;
    case 'copy-f': { const ac = vaultCache.find(x => x.id === d.id); copy(ac.fields[+d.f].v); return; }
    case 'acc-new': S.newAcc = { id: DB.uid(), kind: 'acc', groupId: S.t3g, title: '', order: accsOf(S.t3g).length, fields: [{ k: 'Email', v: '', secret: false }, { k: 'Mật khẩu', v: '', secret: true }] };
      vaultCache.push(S.newAcc); S.editAcc = S.newAcc.id; S.t3new = true; S.q = ''; render(true); app.querySelector('[data-ae="title"]')?.focus(); return;
    case 'acc-menu': {
      const ac = vaultCache.find(x => x.id === d.id);
      popover(el, `<button class="mi" data-ed="1">${I.pen}Sửa</button><button class="mi danger" data-del="1">${I.trash}Xóa tài khoản</button>`, o => {
        if (o.ed) { S.editAcc = d.id; S.t3new = false; S.closed[d.id] = false; render(true); app.querySelector('#accedit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        if (o.del) confirmDlg('Xóa tài khoản?', `"${ac.title}" sẽ bị xóa trên mọi máy.`, 'Xóa', () => { deleteVault(d.id); render(true); toast('Đã xóa'); });
      });
      return;
    }
    case 'acc-edit': S.editAcc = d.id; S.t3new = false; S.closed[d.id] = false; break;
    case 'ae-addf': case 'ae-delf': {
      const n = collectAccEditor();
      if (a === 'ae-addf') n.fields.push({ k: '', v: '', secret: false }); else n.fields.splice(+d.fi, 1);
      const i = vaultCache.findIndex(v => v.id === n.id); vaultCache[i] = n; if (S.newAcc && S.newAcc.id === n.id) S.newAcc = n; break;
    }
    case 'ae-cancel': if (S.t3new) vaultCache = vaultCache.filter(v => v.id !== S.editAcc); S.editAcc = null; S.t3new = false; await refreshVault(); break;
    case 'ae-save': { const n = collectAccEditor(); n.fields = n.fields.filter(f => f.k || f.v); if (!n.title) n.title = 'Không tên'; await saveVault(n); S.editAcc = null; S.t3new = false; S.newAcc = null; toast('Đã lưu, đã mã hóa'); break; }
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

// gõ chữ: lưu ngay, không vẽ lại để không mất con trỏ
const saveTimers = {};
const debounce = (k, fn, ms = 500) => { clearTimeout(saveTimers[k]); saveTimers[k] = setTimeout(fn, ms); };
app.addEventListener('input', e => {
  const t = e.target, kind = t.dataset.edit;
  if (t.id === 'q3') { S.q = t.value; const pos = t.selectionStart; render(true); const q = document.getElementById('q3'); q.focus(); q.setSelectionRange(pos, pos); return; }
  if (kind === 'stk-title') debounce('st' + t.dataset.s, () => stkUpdate(t.dataset.s, s => { s.title = t.textContent.trim(); }));
  if (kind === 'it') { const r = t.closest('.it'); debounce('it' + r.dataset.i, () => stkUpdate(r.dataset.s, s => { const it = s.items.find(x => x.id === r.dataset.i); if (it) it.text = t.textContent; })); }
  if (kind === 'note-name') { const id = S.t2sel; debounce('nn' + id, () => { const n = DB.get('notes', id); n && DB.put('notes', { ...n, name: t.textContent.trim() || 'Không tên', editedAt: Date.now() }); }); }
  if (kind === 'note-body') { const id = S.t2sel; debounce('nb' + id, () => { const n = DB.get('notes', id); n && DB.put('notes', { ...n, body: clean(t.innerHTML), editedAt: Date.now() }); }, 700); }
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
  e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
});

// phím tắt
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.dlg) { S.dlg = null; render(true); } closePop(); return; }
  if (S.tab === 3 && !MK && /^[0-9]$/.test(e.key) && !editing() && !S.dlg && S.t3 !== 'forgot') { pinKey(e.key); return; }
  if (S.tab === 3 && !MK && e.key === 'Backspace' && !editing() && !S.dlg) { pinKey('⌫'); return; }
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
  { item: '.li[data-act="note-pick"]', box: '.list', key: el => el.dataset.id, ok: () => S.tab === 2 && S.t2sort === 'manual', save: ids => saveNoteOrder(ids) }
];
app.addEventListener('pointerdown', e => {
  if (e.button > 0 || e.target.closest('input,button,.pop,.ov')) return;
  for (const cfg of SORTS) {
    const el = e.target.closest(cfg.item);
    if (el && cfg.ok()) { hold = { cfg, el, x: e.clientX, y: e.clientY, t: setTimeout(startDrag, HOLD_MS) }; return; }
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
  el.style.translate = `${drag.px - drag.offX - r.left}px ${drag.py - drag.offY - r.top}px`;
}
window.addEventListener('pointermove', e => {
  if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8) cancelHold();
  if (!drag) return;
  e.preventDefault();
  drag.px = e.clientX; drag.py = e.clientY;
  const sc = drag.scroller, sr = sc && sc.getBoundingClientRect();
  if (sr) { if (e.clientY < sr.top + 50) sc.scrollTop -= 12; else if (e.clientY > sr.bottom - 50) sc.scrollTop += 12; }
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(drag.cfg.item);
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
  follow();
}, { passive: false });
window.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
document.addEventListener('selectstart', e => { if (drag || hold) e.preventDefault(); });
app.addEventListener('contextmenu', e => { if (drag || hold) e.preventDefault(); });
function endDrag() {
  cancelHold();
  if (!drag) return;
  const { cfg, el, box } = drag; drag = null; eatClick = true; setTimeout(() => { eatClick = false; }, 60);
  app.classList.remove('dragging-stk');
  const ids = [...box.querySelectorAll(cfg.item)].map(cfg.key);
  // mục đang kéo bay về chỗ mới
  flip(cfg.item, cfg.key, () => { el.classList.remove('lift'); cfg.save(ids); render(true); }, 300);
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
function saveNoteOrder(ids) {
  quiet = true;
  ids.forEach((id, i) => { const n = DB.get('notes', id); if (n && n.order !== i) DB.put('notes', { ...n, order: i }); });
  quiet = false;
}

// rời app (chuyển sang app khác) là khóa Tab Đỏ; quay lại Tab Đỏ thì hỏi vân tay lại
let bioBusy = false, bioEndAt = 0;
function onLeaveApp() {
  if (bioBusy || !MK) return;
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
DB.onAuth(() => render(true));

// cập nhật
P.onUpdate(u => {
  S.upd = u;
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
