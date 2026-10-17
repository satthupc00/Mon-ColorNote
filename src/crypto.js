// Mã hóa két Tab Đỏ: khóa chính (AES-GCM 256) được "gói" bằng PIN và bằng mã khôi phục.
// Firebase chỉ giữ bản đã mã hóa, không ai đọc được nếu không có PIN / mã khôi phục.
const te = new TextEncoder(), td = new TextDecoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ITER = 210000;

async function deriveKey(secret, saltB64) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: b64(iv), ct: b64(ct) };
}
async function open(key, box) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
}
const importMK = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);

export function makeRecoveryCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(16));
  const s = Array.from(r, x => abc[x % abc.length]).join('');
  return s.match(/.{4}/g).join('-');
}
const normRec = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Tạo két mới. Trả về {meta (lưu/đồng bộ), mk (CryptoKey), mkB64 (cất trên máy), recovery}
export async function createVault(pin) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const recovery = makeRecoveryCode();
  const pinSalt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const recSalt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const meta = {
    keyId: b64(crypto.getRandomValues(new Uint8Array(8))),
    pinSalt, recSalt,
    byPin: await seal(await deriveKey(pin, pinSalt), raw),
    byRec: await seal(await deriveKey(normRec(recovery), recSalt), raw)
  };
  return { meta, mk: await importMK(raw), mkB64: b64(raw), recovery };
}
// Mở két bằng PIN (hoặc mã khôi phục). Sai thì ném lỗi.
export async function unlockWithPin(meta, pin) {
  const raw = await open(await deriveKey(pin, meta.pinSalt), meta.byPin);
  return { mk: await importMK(raw), mkB64: b64(raw) };
}
export async function unlockWithRecovery(meta, code) {
  const raw = await open(await deriveKey(normRec(code), meta.recSalt), meta.byRec);
  return { mk: await importMK(raw), mkB64: b64(raw) };
}
export async function mkFromB64(s) { return importMK(unb64(s)); }
// Đổi PIN: gói lại khóa chính bằng PIN mới
export async function rewrapPin(meta, mkB64, newPin) {
  const pinSalt = b64(crypto.getRandomValues(new Uint8Array(16)));
  return { ...meta, pinSalt, byPin: await seal(await deriveKey(newPin, pinSalt), unb64(mkB64)) };
}
export async function encryptObj(mk, obj) { return seal(mk, te.encode(JSON.stringify(obj))); }
export async function decryptObj(mk, box) { return JSON.parse(td.decode(await open(mk, box))); }
