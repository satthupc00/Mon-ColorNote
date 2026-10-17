// Phân biệt PC (Electron), Android (Capacitor) và trình duyệt; gom các hàm riêng của từng nền tảng
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

export const REPO = 'satthupc00/Mon-ColorNote';
export const isDesktop = !!window.desktop;
export const isAndroid = Capacitor.getPlatform() === 'android';
export const platformName = isDesktop ? 'PC' : isAndroid ? 'Android' : 'Web';
const ApkUpdater = isAndroid ? registerPlugin('ApkUpdater') : null;
const SystemBars = isAndroid ? registerPlugin('SystemBars') : null;
// Android: tô vùng thanh trạng thái / điều hướng cùng màu nền app
export function setSystemBars(theme) {
  if (!SystemBars) return;
  SystemBars.setColor({ color: theme === 'light' ? '#F3F5F9' : '#1B1D23', light: theme === 'light' }).catch(() => {});
}
const SERVER = 'com.mondiro.trinote.vault';

export async function appVersion() {
  if (isDesktop) return window.desktop.version();
  if (isAndroid) return (await CapApp.getInfo()).version;
  return __APP_VERSION__;
}

// ---------- Sinh trắc học ----------
export async function bioAvailable() {
  try {
    if (isDesktop) return await window.desktop.bioAvailable();
    if (isAndroid) return (await NativeBiometric.isAvailable()).isAvailable;
  } catch {}
  return false;
}
export async function bioVerify(reason = 'Mở khóa Tab Đỏ') {
  try {
    if (isDesktop) return await window.desktop.bioVerify(reason);
    if (isAndroid) { await NativeBiometric.verifyIdentity({ reason, title: 'Mon TriNote', subtitle: reason, negativeButtonText: 'Dùng mã PIN' }); return true; }
  } catch {}
  return false;
}
// Cất khóa két trên máy (Windows: safeStorage, Android: Keystore). Trình duyệt: không cất.
export async function keySave(b64) {
  try {
    if (isDesktop) return await window.desktop.keySave(b64);
    if (isAndroid) { await NativeBiometric.setCredentials({ username: 'mk', password: b64, server: SERVER }); return true; }
  } catch {}
  return false;
}
export async function keyLoad() {
  try {
    if (isDesktop) return await window.desktop.keyLoad();
    if (isAndroid) return (await NativeBiometric.getCredentials({ server: SERVER })).password || null;
  } catch {}
  return null;
}
export async function keyClear() {
  try {
    if (isDesktop) return await window.desktop.keyClear();
    if (isAndroid) await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {}
}

// ---------- Cập nhật ----------
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
// cb nhận {ev:'checking'|'latest'|'available'|'progress'|'downloaded'|'error', version, percent, message}
let updCb = () => {}, apkUrl = null;
export function onUpdate(cb) {
  updCb = cb;
  if (isDesktop) window.desktop.onUpdate(cb);
  if (isAndroid) ApkUpdater.addListener('progress', p => cb({ ev: 'progress', percent: p.percent }));
}
export async function checkUpdate() {
  updCb({ ev: 'checking' });
  if (isDesktop) return window.desktop.checkUpdate();
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 404) return updCb({ ev: 'latest' });
    if (!r.ok) throw new Error('GitHub trả về ' + r.status);
    const rel = await r.json();
    const latest = String(rel.tag_name || '').replace(/^v/, '');
    const cur = await appVersion();
    const apk = (rel.assets || []).find(a => a.name.endsWith('.apk'));
    if (latest && cmp(latest, cur) > 0 && (apk || !isAndroid)) { apkUrl = apk && apk.browser_download_url; updCb({ ev: 'available', version: latest }); }
    else updCb({ ev: 'latest' });
  } catch (e) { updCb({ ev: 'error', message: e.message }); }
}
export async function installUpdate() {
  if (isDesktop) { updCb({ ev: 'progress', percent: 0 }); return window.desktop.downloadUpdate(); }
  if (isAndroid && apkUrl) {
    updCb({ ev: 'progress', percent: 0 });
    try { await ApkUpdater.downloadAndInstall({ url: apkUrl }); updCb({ ev: 'downloaded', android: true }); }
    catch (e) { updCb({ ev: 'error', message: e.message === 'NEED_PERMISSION' ? 'Hãy cho phép "Cài ứng dụng không rõ nguồn" cho Mon TriNote rồi bấm Cập nhật lần nữa' : e.message }); }
  }
}
export function restartToUpdate() { if (isDesktop) window.desktop.installUpdate(); }
