// Window creation + the whole renderer hardening battery, in one place so the
// headless probe can install the exact same security posture the real app has
// (scripts/probe.cjs calls installSecurity({ isDev: false })).
//
// Adopted from cartapriscus/electron/main.cjs and mundifex/electron/main.cjs.

const { BrowserWindow, session, Menu } = require('electron');
const path = require('path');

const netallow = require('./netallow.cjs');

const DEV_PORT = 5280;
const DEV_URL = `http://localhost:${DEV_PORT}`;

/**
 * Content-Security-Policy for both modes.
 *
 * - No 'unsafe-eval' in either mode. All renderer deps here are pure JS
 *   (React, motion, zustand) so nothing needs it — unlike the Pixi-based
 *   sibling apps, which is also why sandbox stays ON below.
 * - `cardimg:` in img-src is the custom privileged scheme that serves cached
 *   Scryfall art off disk (electron/cardimg.cjs). Card art is NEVER fetched by
 *   the renderer and never bundled; main downloads it, the renderer reads it
 *   back through this scheme only.
 * - connect-src is 'self' PLUS the multiplayer origins the user has explicitly
 *   configured — and nothing else. Every other outbound call (Scryfall bulk
 *   data, card art) still happens in MAIN behind a host allowlist. M4 widened
 *   this deliberately; D48 records the reasoning, and `electron/netallow.cjs`
 *   owns the decision about which origins qualify.
 *
 *   ⚠️ PER ORIGIN, NEVER PER SCHEME. `connect-src 'self' wss:` would let a
 *   compromised renderer post anywhere on the internet, which is precisely the
 *   posture D4 was protecting. The list is computed HERE, on every document
 *   load, from validated settings — so adding a relay takes one reload rather
 *   than a permanent hole.
 */
function cspFor(isDev) {
  const multiplayer = netallow.connectSources().join(' ');
  const common = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: cardimg:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ];
  return isDev
    ? [
        ...common,
        "script-src 'self' 'unsafe-inline'",
        "script-src-elem 'self' 'unsafe-inline'",
        // Vite HMR, plus the configured multiplayer origins.
        `connect-src 'self' ws://localhost:* ${multiplayer}`,
      ].join('; ')
    : [
        ...common,
        "script-src 'self'",
        `connect-src 'self'${multiplayer ? ` ${multiplayer}` : ''}`,
      ].join('; ');
}

/**
 * Session-wide guards. Idempotent enough to call once at startup.
 * Separated from createWindow so the headless probe gets the same posture.
 */
function installSecurity({ isDev }) {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspFor(isDev)],
      },
    });
  });

  // Deny every permission request (camera, microphone, geolocation, …).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);

  // No application menu in packaged builds, so DevTools isn't one keystroke away.
  if (!isDev) Menu.setApplicationMenu(null);
}

function getIconPath(isDev) {
  return isDev
    ? path.join(__dirname, '..', 'build', 'icon.ico')
    : path.join(process.resourcesPath, 'icon.ico');
}

/** Guard navigation and window-opening on a specific webContents. */
function guardContents(webContents, isDev) {
  // Origin-based, never a string prefix — 'http://localhost:5280.evil.com'
  // passes a startsWith check and must not pass this one.
  webContents.on('will-navigate', (event, url) => {
    let allowed = false;
    try {
      const u = new URL(url);
      allowed = isDev
        ? u.protocol === 'http:' && u.hostname === 'localhost' && u.port === String(DEV_PORT)
        : u.protocol === 'file:';
    } catch { allowed = false; }
    if (!allowed) event.preventDefault();
  });

  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Nothing may attach a webview.
  webContents.on('will-attach-webview', (event) => event.preventDefault());
}

function createWindow({ isDev, bounds }) {
  const win = new BrowserWindow({
    width: bounds?.width ?? 1500,
    height: bounds?.height ?? 950,
    ...(Number.isInteger(bounds?.x) ? { x: bounds.x } : {}),
    ...(Number.isInteger(bounds?.y) ? { y: bounds.y } : {}),
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0d1117',
    title: "Commander's Roundtable",
    icon: getIconPath(isDev),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Every renderer dependency is pure JS, so the sandbox stays ON.
      // (cartapriscus must disable it only because PixiJS requires it.)
      sandbox: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  guardContents(win.webContents, isDev);

  if (bounds?.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  if (isDev) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  return win;
}

module.exports = { createWindow, installSecurity, guardContents, cspFor, DEV_URL, DEV_PORT };
