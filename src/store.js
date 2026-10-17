// Kho dữ liệu: lưu ngay trên máy (localStorage) và đồng bộ 2 chiều với Firestore khi đã đăng nhập.
// Mỗi mục có updatedAt; bản nào mới hơn thì thắng. Xóa = đánh dấu deleted để máy khác cũng xóa theo.
import firebaseConfig from './firebase-config.js';

export const COLLS = ['stickers', 'notes', 'vault', 'meta'];
const listeners = new Set();
export const onChange = fn => listeners.add(fn);
const emit = (coll) => listeners.forEach(fn => fn(coll));

let scope = 'local';
const maps = Object.fromEntries(COLLS.map(c => [c, new Map()]));
const lsKey = (s, c) => `tn:${s}:${c}`;
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function loadScope(s) {
  scope = s;
  for (const c of COLLS) { maps[c].clear(); for (const it of lsGet(lsKey(s, c))) maps[c].set(it.id, it); }
}
const persist = c => lsSet(lsKey(scope, c), [...maps[c].values()]);
loadScope('local');

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const all = c => [...maps[c].values()].filter(x => !x.deleted);
export const get = (c, id) => { const x = maps[c].get(id); return x && !x.deleted ? x : null; };

export function put(c, item) {
  const it = { ...item, updatedAt: Date.now() };
  maps[c].set(it.id, it); persist(c); emit(c);
  push(c, it);
  return it;
}
export function remove(c, id) {
  const it = maps[c].get(id); if (!it) return;
  put(c, { id, deleted: true, ...(it.keyId ? { keyId: it.keyId } : {}) });
}

// ---------------- Firebase ----------------
export const hasFirebase = !!firebaseConfig;
let fb = null, user = null, unsubs = [];
const authListeners = new Set();
export const onAuth = fn => authListeners.add(fn);
export const currentUser = () => user;
export const syncState = { status: hasFirebase ? 'offline' : 'local', at: 0 };
const setSync = (status) => { syncState.status = status; syncState.at = Date.now(); emit('sync'); };

async function lib() {
  if (fb) return fb;
  const [{ initializeApp }, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentSingleTabManager() }) }); }
  catch { db = F.getFirestore(app); }
  fb = { A, F, auth, db };
  return fb;
}

function push(c, it) {
  if (!user || !fb) return;
  if (c === 'vault' && it.keyId && vaultKeyId() && it.keyId !== vaultKeyId()) return; // dữ liệu két cũ không khớp khóa
  const { F, db } = fb;
  setSync('syncing');
  F.setDoc(F.doc(db, 'users', user.uid, c, it.id), JSON.parse(JSON.stringify(it)))
    .then(() => setSync('synced')).catch(() => setSync('error'));
}
const vaultKeyId = () => (maps.meta.get('sec') || {}).keyId;

function listen() {
  const { F, db } = fb;
  for (const c of COLLS) {
    let first = true;
    unsubs.push(F.onSnapshot(F.collection(db, 'users', user.uid, c), snap => {
      const remoteIds = new Set();
      let changed = false;
      snap.forEach(d => {
        const r = d.data(); remoteIds.add(d.id);
        const l = maps[c].get(d.id);
        if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) {
          if (c === 'meta' && d.id === 'sec' && l && l.keyId !== r.keyId) lsSet(`tn:orphan:${Date.now()}`, all('vault'));
          maps[c].set(d.id, r); changed = true;
        }
      });
      if (first) {
        first = false;
        // gửi lên các mục máy này có mà Firestore chưa có / cũ hơn
        for (const it of maps[c].values()) {
          const r = snap.docs.find(d => d.id === it.id);
          if (!r || (r.data().updatedAt || 0) < (it.updatedAt || 0)) push(c, it);
        }
      }
      if (changed) { persist(c); emit(c); }
      if (!snap.metadata.hasPendingWrites) setSync(snap.metadata.fromCache ? 'offline' : 'synced');
    }, () => setSync('error')));
  }
}

export async function initSync() {
  if (!hasFirebase) return;
  const { A, auth } = await lib();
  A.onAuthStateChanged(auth, u => {
    unsubs.forEach(f => f()); unsubs = [];
    user = u;
    if (u) {
      const localData = Object.fromEntries(COLLS.map(c => [c, lsGet(lsKey('local', c))]));
      loadScope(u.uid);
      // lần đầu đăng nhập: gộp dữ liệu đã tạo khi chưa đăng nhập
      for (const c of COLLS) for (const it of localData[c]) {
        const cur = maps[c].get(it.id);
        if (c === 'meta' && it.id === 'sec' && cur) continue;
        if (!cur || cur.updatedAt < it.updatedAt) maps[c].set(it.id, it);
      }
      COLLS.forEach(c => { persist(c); lsSet(lsKey('local', c), []); });
      listen();
    } else {
      loadScope('local'); setSync('offline');
    }
    COLLS.forEach(emit);
    authListeners.forEach(fn => fn(u));
  });
}

const authMsg = e => ({
  'auth/invalid-credential': 'Sai email hoặc mật khẩu', 'auth/wrong-password': 'Sai mật khẩu', 'auth/user-not-found': 'Chưa có tài khoản với email này',
  'auth/email-already-in-use': 'Email này đã có tài khoản, hãy đăng nhập', 'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự',
  'auth/invalid-email': 'Email không hợp lệ', 'auth/network-request-failed': 'Không có mạng', 'auth/too-many-requests': 'Thử sai nhiều quá, đợi một lúc nhé', 'auth/operation-not-allowed': 'Chưa bật đăng nhập Email/Password trong Firebase'
}[e.code] || e.message);
export async function signIn(email, pass) { const { A, auth } = await lib(); try { await A.signInWithEmailAndPassword(auth, email, pass); } catch (e) { throw new Error(authMsg(e)); } }
export async function signUp(email, pass) { const { A, auth } = await lib(); try { await A.createUserWithEmailAndPassword(auth, email, pass); } catch (e) { throw new Error(authMsg(e)); } }
export async function resetPass(email) { const { A, auth } = await lib(); try { await A.sendPasswordResetEmail(auth, email); } catch (e) { throw new Error(authMsg(e)); } }
export async function signOutUser() { const { A, auth } = await lib(); await A.signOut(auth); }
