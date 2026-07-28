// Commander's Roundtable — Electron main process.
//
// Responsibilities, and nothing else:
//   • own the window and the whole hardening posture      (window.cjs)
//   • own the data root on disk                            (paths.cjs)
//   • gate every renderer filesystem request               (capability.cjs)
//   • own all outbound network access                      (scryfall.cjs, M1.5)
//   • serve cached card art back to the renderer           (cardimg.cjs, M1.4)
//   • supervise the card-database worker                   (cardsvc.cjs, M1.5)
//
// The game engine lives in the RENDERER (src/engine/) as a pure TS module. Main
// never sees game state.

const { app, BrowserWindow } = require('electron');
const os = require('os');

const paths = require('./paths.cjs');

// ⚠️ MUST run before app.whenReady() and before anything reads a userData path,
// or Chromium creates its profile in the default (MSIX-virtualized) location.
// See the long comment in paths.cjs.
paths.installAppPaths(app);

const cardimg = require('./cardimg.cjs');

// ⚠️ Also before app.whenReady(): registering a privileged scheme after the app
// is ready silently does nothing, and the failure looks like "images 404".
cardimg.registerScheme();

const capability = require('./capability.cjs');
const settings = require('./settings.cjs');
const winstate = require('./winstate.cjs');
const updater = require('./updater.cjs');
const cardsvc = require('./cardsvc.cjs');
const lanServer = require('./lanServer.cjs');
const { registerIpc } = require('./ipc.cjs');
const { createWindow, installSecurity, DEV_URL } = require('./window.cjs');

const isDev = process.argv.includes('--dev') || !app.isPackaged;

let mainWindow = null;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

// ─────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────

// One instance owns the data root. A second launch just focuses the first —
// two processes sharing settings.json and the image queue would corrupt both.
// (Hosting and joining on ONE machine is still possible: give the second
// instance its own CRT_DATA_DIR, which also gives it its own lock.)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    capability.init();

    // First launch: seed a player name from the OS user so the lobby is not blank.
    if (!settings.get().playerName) {
      let guess = '';
      try { guess = (os.userInfo().username || '').trim(); } catch { /* no userInfo */ }
      settings.set({ playerName: guess || 'Player' });
    }

    installSecurity({ isDev });

    // A card rendered without cached art is itself the request to fetch it: the
    // protocol handler reports the miss, and we hand it to the worker (which owns
    // the queue and the network). Batched, because a table full of new cards
    // produces a burst of misses in the same frame and one IPC round trip per
    // image would be wasteful.
    let missBatch = [];
    let missTimer = null;
    cardimg.installHandler({
      onMiss: (tier, imageId) => {
        missBatch.push({ tier, imageId });
        if (missTimer) return;
        missTimer = setTimeout(() => {
          const items = missBatch;
          missBatch = [];
          missTimer = null;
          cardsvc.call('enqueueImages', { items }).catch(() => {
            // The worker may be down; the next render re-reports the same misses.
          });
        }, 300);
      },
    });

    registerIpc({ app, isDev });

    mainWindow = createWindow({ isDev, bounds: winstate.load() });
    winstate.track(mainWindow);
    mainWindow.on('closed', () => { mainWindow = null; });

    // The worker is started lazily by the first request rather than here: an
    // idle launch should not fork a process that may have nothing to do.
    cardsvc.attachWindow(mainWindow);

    updater.start({
      app,
      onStatus: (status) => sendToRenderer('updater:status', status),
    });

    console.log(`[main] ${isDev ? 'dev' : 'production'} · data root ${paths.dataRoot()}` +
      (isDev ? ` · renderer ${DEV_URL}` : ''));
  });

  app.on('before-quit', () => {
    cardsvc.shutdown();
    // ⚠️ The LAN listener must not outlive the app. A socket left bound to
    // 0.0.0.0 after the window closed is a listener on somebody's home network
    // that nobody knows is open — see the header of lanServer.cjs.
    void lanServer.stop();
  });

  app.on('window-all-closed', () => app.quit());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow({ isDev, bounds: winstate.load() });
      winstate.track(mainWindow);
    }
  });
}
