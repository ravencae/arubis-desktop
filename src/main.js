// Arubis for Mac and Windows: the Arubis web app in its own window, with native menus, downloads and updates.
const { app, BrowserWindow, Menu, shell, session, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const HOME = 'https://arubis.olympuspay.co'
const START = `${HOME}/home`
// Sign-in pages for connected apps open inside the window so the connection lands in these books.
const INSIDE = [/^https:\/\/arubis\.olympuspay\.co\//, /^https:\/\/accounts\.google\.com\//, /^https:\/\/login\.microsoftonline\.com\//, /^https:\/\/login\.live\.com\//, /^https:\/\/connect\.stripe\.com\//, /^https:\/\/[a-z0-9-]+\.myshopify\.com\/admin\/oauth\//, /^https:\/\/checkout\.stripe\.com\//, /^https:\/\/billing\.stripe\.com\//]
const inside = (url) => INSIDE.some((r) => r.test(url))

if (!app.requestSingleInstanceLock()) app.quit()

const stateFile = () => path.join(app.getPath('userData'), 'window.json')
function loadBounds() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) } catch { return { width: 1440, height: 900 } } }
function saveBounds(win) { try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })) } catch { /* not critical */ } }

let win
function createWindow() {
  const b = loadBounds()
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, minWidth: 1024, minHeight: 680,
    title: 'Arubis', backgroundColor: '#ffffff', show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  })
  if (b.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  for (const ev of ['resize', 'move', 'close']) win.on(ev, () => saveBounds(win))

  // A plain Chrome user agent: some sign-in pages refuse browsers they do not recognise.
  win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/\s?(Electron|arubis-desktop)\/\S+/g, ''))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (inside(url)) { win.loadURL(url); return { action: 'deny' } }
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => { if (!inside(url)) { e.preventDefault(); if (/^(https?|mailto):/.test(url)) shell.openExternal(url) } })

  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3) return // -3: navigation replaced by another
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { to: url || START } })
  })

  win.loadURL(START)
}

function buildMenu() {
  const mac = process.platform === 'darwin'
  const go = (p) => () => win?.loadURL(HOME + p)
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New window', accelerator: 'CmdOrCtrl+N', click: () => { const w = win; createWindow(); if (w && !w.isDestroyed()) w.focus() } },
      { type: 'separator' }, { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => win?.webContents.print() },
      { type: 'separator' }, mac ? { role: 'close' } : { role: 'quit' },
    ] },
    { role: 'editMenu' },
    { label: 'Go', submenu: [
      { label: 'Home', accelerator: 'CmdOrCtrl+1', click: go('/home') },
      { label: 'Invoices', accelerator: 'CmdOrCtrl+2', click: go('/invoices') },
      { label: 'Bills', accelerator: 'CmdOrCtrl+3', click: go('/bills') },
      { label: 'Transactions', accelerator: 'CmdOrCtrl+4', click: go('/transactions') },
      { label: 'Reports', accelerator: 'CmdOrCtrl+5', click: go('/reports') },
      { label: 'Athena', accelerator: 'CmdOrCtrl+6', click: go('/athena') },
      { type: 'separator' },
      { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => win?.webContents.navigationHistory.goBack() },
      { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => win?.webContents.navigationHistory.goForward() },
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win?.webContents.reload() },
    ] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [
      { label: 'Open Arubis in your browser', click: () => shell.openExternal(win?.webContents.getURL().startsWith(HOME) ? win.webContents.getURL() : HOME) },
      { label: 'Legal', click: () => shell.openExternal(`${HOME}/legal`) },
      { label: 'Contact support', click: () => shell.openExternal('mailto:hello@olympuspay.co') },
    ] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function checkForUpdates() {
  // Windows installs update themselves from GitHub releases. The Mac build updates once it is signed with an Apple Developer ID.
  if (!app.isPackaged || process.platform !== 'win32') return
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  } catch { /* updater unavailable */ }
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
app.whenReady().then(() => {
  // Downloads (exports, payslips, packs) ask where to save, like a browser.
  session.defaultSession.on('will-download', (_e, item) => {
    item.once('done', (_ev, state) => { if (state === 'interrupted') dialog.showErrorBox('Download failed', `${item.getFilename()} could not be saved.`) })
  })
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['clipboard-sanitized-write', 'notifications', 'fullscreen'].includes(perm) && wc.getURL().startsWith(HOME)))
  buildMenu()
  createWindow()
  checkForUpdates()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
