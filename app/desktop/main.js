/* Fantasy Kritter — desktop shell.
 *
 * The game is one self-contained HTML file, so this process owns nothing but
 * the window. Everything below is either about making a portrait phone game
 * behave on a desktop, or about locking down a renderer that has no business
 * touching the system.
 */
'use strict';
const { app, BrowserWindow, Menu, net, protocol, screen, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB_ROOT = path.join(__dirname, 'web');

/* The game is served over a custom scheme rather than loaded with loadFile.
 * A file:// page gets an origin that browsers treat as special-cased and
 * partly untrusted; a registered standard scheme gets a normal origin, so
 * localStorage — where every saved run lives — persists across launches the
 * same way it does in a browser tab. The iOS shell does the same thing for the
 * same reason. `secure` additionally keeps the page out of mixed-content and
 * powerful-feature restrictions. */
const SCHEME = 'kritter';
const START = `${SCHEME}://game/index.html`;

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

// The layout is designed for a phone held upright. On a desktop we keep that
// shape rather than stretching it, and let the window scale as a unit.
const ASPECT = 460 / 900;

let win = null;

function serveBundle() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const relative = !pathname || pathname === '/' ? '/index.html' : pathname;
    const file = path.join(WEB_ROOT, decodeURIComponent(relative));

    // `..` in a request must not be able to read the rest of the install.
    if (file !== WEB_ROOT && !file.startsWith(WEB_ROOT + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  // Never open taller than the display — on a 768 px laptop a fixed 900 px
  // window would put the bottom row of the formation screen off screen.
  const work = screen.getPrimaryDisplay().workAreaSize;
  const height = Math.min(900, Math.round(work.height * 0.92));
  const width = Math.round(height * ASPECT);

  win = new BrowserWindow({
    width,
    height,
    minWidth: 320,
    minHeight: Math.round(320 / ASPECT),
    backgroundColor: '#141024',
    title: 'Fantasy Kritter',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true,
    show: false,                    // avoid a white flash before the first paint
    // No preload. The page saves through localStorage and synthesises its own
    // audio, so it has nothing to ask this process for — and a bridge that
    // exposes nothing is just a hole waiting for someone to widen it.
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,  // the battle loop should not stutter when unfocused
    },
  });

  win.setAspectRatio(ASPECT);
  win.once('ready-to-show', () => win.show());
  win.loadURL(START);

  // The game never links out. If some future build does, it opens in the real
  // browser rather than inside a chromeless game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://`)) e.preventDefault();
  });

  win.on('closed', () => { win = null; });
}

/* A game does not need an Edit menu. Keep only the shortcuts a player would
 * actually reach for, so Cmd+Q and full screen still work on macOS. */
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Spil',
      submenu: [
        {
          label: 'Fuld skærm',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => win && win.setFullScreen(!win.isFullScreen()),
        },
        {
          label: 'Genindlæs',
          accelerator: 'CmdOrCtrl+R',
          click: () => win && win.reload(),
        },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit', label: 'Afslut' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// One window is the whole app; a second instance should raise the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    serveBundle();
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
