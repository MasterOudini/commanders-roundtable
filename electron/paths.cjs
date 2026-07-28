// Where Commander's Roundtable keeps everything it owns on disk.
//
// ⚠️ DELIBERATELY NOT %APPDATA% / %LOCALAPPDATA%.
// The Claude desktop app is MSIX-containerized, so %LOCALAPPDATA% and %APPDATA%
// writes made from an agent session are VIRTUALIZED into
//   …\Packages\Claude_…\LocalCache\Local\…
// A card database or image cache written while developing would therefore NOT be
// the directory the user's real app reads — the app would look empty and
// re-download 550 MB. Mundifex hit exactly this and moved its runtime to a
// profile-root dotfolder for the same reason (mundifex/docs/DECISIONS.md D15).
//
// So: one profile-root dotfolder, identical for the dev app, the packaged app,
// and anything an agent session runs. CRT_DATA_DIR overrides it, which is what
// lets two Electron instances host+join on one machine without sharing a
// profile (they would collide on settings, decks and the image queue).

const os = require('os');
const path = require('path');
const fs = require('fs');

const DEFAULT_DIR_NAME = '.commanders-roundtable';

let cachedRoot = null;

/**
 * Where the data root lives when nothing overrides it. Kept separate from
 * dataRoot() so a test can assert on the real default even while running under
 * a throwaway CRT_DATA_DIR.
 */
function defaultDataRoot() {
  return path.join(os.homedir(), DEFAULT_DIR_NAME);
}

/** The single data root. Absolute, created on demand. */
function dataRoot() {
  if (cachedRoot) return cachedRoot;
  const override = process.env.CRT_DATA_DIR;
  cachedRoot = override && override.trim()
    ? path.resolve(override.trim())
    : defaultDataRoot();
  return cachedRoot;
}

/** Sub-path inside the data root. Does NOT create anything. */
function inData(...parts) {
  return path.join(dataRoot(), ...parts);
}

const dirs = {
  root: () => dataRoot(),
  cards: () => inData('cards'),        // NDJSON + index + meta.json
  downloads: () => inData('downloads'), // in-progress bulk .gz (resumable)
  images: () => inData('images'),      // card art, sharded by scryfall id
  decks: () => inData('decks'),
  deckTrash: () => inData('decks', 'trash'),
  games: () => inData('games'),        // append-only NDJSON event logs
  logs: () => inData('logs'),
};

const files = {
  settings: () => inData('settings.json'),
  window: () => inData('window.json'),
  authorizedDirs: () => inData('authorized-dirs.json'),
  cardMeta: () => path.join(dirs.cards(), 'meta.json'),
  cardNdjson: () => path.join(dirs.cards(), 'cards.ndjson'),
  cardIndex: () => path.join(dirs.cards(), 'cards.idx'),
  imageQueue: () => inData('imgqueue.json'),
  deckIndex: () => path.join(dirs.decks(), 'index.json'),
};

/** Create every directory the app writes into. Safe to call repeatedly. */
function ensureDirs() {
  for (const make of Object.values(dirs)) {
    try { fs.mkdirSync(make(), { recursive: true }); } catch { /* best effort */ }
  }
}

/**
 * Point Electron's own userData at our root. MUST be called before
 * app.whenReady() and before anything reads app.getPath('userData'),
 * or Chromium will already have created its profile in the default location.
 */
function installAppPaths(app) {
  const root = dataRoot();
  fs.mkdirSync(root, { recursive: true });
  app.setPath('userData', root);
  // Chromium's own cache/profile noise goes in a subfolder so the data root
  // stays legible to a human opening it in Explorer.
  app.setPath('sessionData', path.join(root, 'chromium'));
  ensureDirs();
  return root;
}

module.exports = { dataRoot, defaultDataRoot, inData, dirs, files, ensureDirs, installAppPaths };
