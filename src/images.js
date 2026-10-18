// Hình dán vào ghi chú: nén nhỏ (WebP, tối đa 1600px), lưu trong IndexedDB trên máy
// và mỗi hình 1 tài liệu riêng trên đám mây (mỗi tài liệu < 1MB). Ghi chú chỉ giữ mã hình.
import * as DB from './store.js';

const MAX_SIDE = 1600, MAX_LEN = 700 * 1024;
let dbp;
function idb() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('trinote-img', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('img', mode); const st = t.objectStore('img'); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
}
const localGet = id => tx('readonly', st => st.get(id));
const localPut = rec => tx('readwrite', st => st.put(rec));
const localAll = () => tx('readonly', st => st.getAll());
const localDel = id => tx('readwrite', st => st.delete(id));

// nén ảnh (blob hoặc dataURL) thành dataURL WebP đủ nhỏ để lưu
export async function compress(src) {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  if (typeof src !== 'string') URL.revokeObjectURL(url);
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight)), q = .85, out = '';
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    out = c.toDataURL('image/webp', q);
    if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', q);
    if (out.length <= MAX_LEN) break;
    if (q > .55) q -= .12; else scale *= .8;
  }
  return out;
}

const mem = new Map();
export async function save(dataUrl) {
  const id = 'img' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const rec = { id, data: dataUrl, at: Date.now(), up: false };
  mem.set(id, dataUrl);
  await localPut(rec);
  if (await DB.remotePut('images', id, { data: dataUrl, at: rec.at }).catch(() => false)) await localPut({ ...rec, up: true });
  return id;
}
export async function load(id) {
  if (mem.has(id)) return mem.get(id);
  let r = await localGet(id).catch(() => null);
  if (!r) {
    const d = await DB.remoteGet('images', id).catch(() => null);
    if (d) { r = { id, data: d.data, at: d.at, up: true }; await localPut(r).catch(() => {}); }
  }
  if (r) mem.set(id, r.data);
  return r ? r.data : null;
}
// sau khi đăng nhập: đưa các hình dán lúc chưa đăng nhập lên đám mây
export async function uploadPending() {
  for (const r of await localAll().catch(() => [])) {
    if (!r.up && await DB.remotePut('images', r.id, { data: r.data, at: r.at }).catch(() => false)) await localPut({ ...r, up: true });
  }
}
export async function remove(id) { mem.delete(id); await localDel(id).catch(() => {}); DB.remoteDel('images', id); }
