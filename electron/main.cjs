// Mon TriNote — tiến trình chính của Electron (PC)
const { app, BrowserWindow, ipcMain, safeStorage, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { autoUpdater } = require('electron-updater');

const userDir = app.getPath('userData');
const winStateFile = path.join(userDir, 'window.json');
const keyFile = path.join(userDir, 'vault.key');
let win;

function loadWinState() {
  try {
    const s = JSON.parse(fs.readFileSync(winStateFile, 'utf8'));
    const area = screen.getDisplayMatching(s).workArea;
    if (s.x >= area.x - 50 && s.y >= area.y - 50) return s;
    return { width: s.width, height: s.height, maximized: s.maximized };
  } catch { return { width: 1180, height: 760 }; }
}

function createWindow() {
  const st = loadWinState();
  win = new BrowserWindow({
    ...st, minWidth: 420, minHeight: 560,
    title: 'Mon TriNote', backgroundColor: '#1B1D23', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  if (st.maximized) win.maximize();
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  const save = () => {
    if (!win || win.isDestroyed()) return;
    const b = win.getNormalBounds();
    try { fs.writeFileSync(winStateFile, JSON.stringify({ ...b, maximized: win.isMaximized() })); } catch {}
  };
  win.on('close', save);
}

// ---------- Windows Hello (vân tay / khuôn mặt) qua PowerShell ----------
function windowsHello(reason) {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve('UNAVAILABLE');
    const script = path.join(__dirname, 'hello.ps1').replace('app.asar', 'app.asar.unpacked');
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, reason || 'Mon TriNote'],
      { windowsHide: true, timeout: 120000 }, (err, out) => {
        if (err) return resolve('ERROR');
        resolve(String(out).trim().split(/\r?\n/).pop());
      });
    // đưa hộp thoại Windows Hello lên trên cửa sổ app
    setTimeout(() => { try { win.blur(); } catch {} }, 400);
  });
}
ipcMain.handle('bio:available', async () => (await windowsHello('check')) !== 'UNAVAILABLE' ? true : false);
ipcMain.handle('bio:verify', async (_e, reason) => (await windowsHello(reason)) === 'Verified');

// ---------- Khóa két (master key) cất bằng safeStorage của Windows ----------
ipcMain.handle('key:save', (_e, b64) => {
  if (!safeStorage.isEncryptionAvailable()) return false;
  fs.writeFileSync(keyFile, safeStorage.encryptString(b64)); return true;
});
ipcMain.handle('key:load', () => {
  try { return safeStorage.decryptString(fs.readFileSync(keyFile)); } catch { return null; }
});
ipcMain.handle('key:clear', () => { try { fs.unlinkSync(keyFile); } catch {} return true; });

// ---------- Tự cập nhật từ GitHub Releases ----------
autoUpdater.autoDownload = false;
const send = (ev, data) => { if (win && !win.isDestroyed()) win.webContents.send('upd', { ev, ...data }); };
autoUpdater.on('update-available', i => send('available', { version: i.version }));
autoUpdater.on('update-not-available', () => send('latest'));
autoUpdater.on('download-progress', p => send('progress', { percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', () => send('downloaded'));
autoUpdater.on('error', e => send('error', { message: String(e && e.message || e) }));
ipcMain.handle('upd:check', async () => {
  if (!app.isPackaged) { send('latest'); return; }
  try { await autoUpdater.checkForUpdates(); } catch (e) { send('error', { message: String(e.message || e) }); }
});
ipcMain.handle('upd:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('upd:install', () => autoUpdater.quitAndInstall(true, true));
ipcMain.handle('app:version', () => app.getVersion());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
