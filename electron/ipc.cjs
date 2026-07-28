// Every IPC channel, in one place.
//
// Separated from main.cjs so scripts/probe.cjs can install the exact same
// surface the real app has. A probe that has to reimplement handlers is testing
// the probe, not the app.
//
// Rules for anything added here:
//   1. No generic path-taking read/write channel. Ever.
//   2. Any handler that accepts a path from the renderer MUST pass it through
//      capability.canReadPath / canWritePath, or resolve it inside a directory
//      we chose with capability.resolveInsideDir.
//   3. Outbound network access belongs in main behind a host allowlist — never
//      handed to the renderer.

const { ipcMain, shell } = require('electron');

const paths = require('./paths.cjs');
const settings = require('./settings.cjs');
const updater = require('./updater.cjs');
const cardsvc = require('./cardsvc.cjs');
const decks = require('./decks.cjs');
const deckfetch = require('./deckfetch.cjs');
const netallow = require('./netallow.cjs');
const lanServer = require('./lanServer.cjs');
const gamelog = require('./gamelog.cjs');

/**
 * @param {object} o
 * @param {Electron.App} o.app
 * @param {boolean} o.isDev
 */
function registerIpc({ app, isDev }) {
  ipcMain.handle('app:info', () => ({
    name: "Commander's Roundtable",
    version: app.getVersion(),
    isDev,
    isPackaged: app.isPackaged,
    platform: process.platform,
    dataRoot: paths.dataRoot(),
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
  }));

  // Reveals a directory WE own — no renderer-supplied path is involved.
  ipcMain.handle('app:showDataFolder', async () => {
    await shell.openPath(paths.dataRoot());
    return true;
  });

  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:set', (_e, patch) => settings.set(patch));
  ipcMain.handle('settings:defaults', () => settings.defaults());

  ipcMain.handle('updater:status', () => updater.getStatus());

  // ── Card database ──
  // The renderer can ask for a sync; it can never name a URL. Every outbound
  // request happens in the worker behind scryfall.cjs's host allowlist.
  ipcMain.handle('carddb:status', () => cardsvc.getStatus());
  ipcMain.handle('carddb:sync', (_e, options) => cardsvc.sync({
    // Only this one flag crosses the boundary, and it is coerced — never pass a
    // renderer object through to the worker as-is.
    force: options?.force === true,
  }));
  ipcMain.handle('carddb:cancel', () => cardsvc.cancel());
  ipcMain.handle('carddb:restart', () => cardsvc.restart());
  ipcMain.handle('carddb:logTail', () => cardsvc.getLogTail());

  // ── Card queries ──
  // Arguments are coerced field by field rather than forwarded as objects: the
  // worker should never receive a renderer-shaped payload it might trust.
  const str = (v) => (typeof v === 'string' ? v : '');
  const optStr = (v) => (typeof v === 'string' && v.length > 0 ? v : undefined);
  const idList = (v, cap) =>
    (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []).slice(0, cap);

  ipcMain.handle('carddb:indexStats', () => cardsvc.call('indexStats'));
  ipcMain.handle('carddb:byId', (_e, id) => cardsvc.call('byId', { id: str(id) }));
  ipcMain.handle('carddb:hydrate', (_e, ids) =>
    cardsvc.call('hydrate', { ids: idList(ids, 5000) }));
  ipcMain.handle('carddb:byName', (_e, q) => cardsvc.call('byName', {
    name: str(q?.name),
    set: optStr(q?.set),
    collectorNumber: optStr(q?.collectorNumber),
  }));
  ipcMain.handle('carddb:resolveNames', (_e, entries) => cardsvc.call('resolveNames', {
    entries: (Array.isArray(entries) ? entries : []).slice(0, 2000).map((entry) => ({
      name: str(entry?.name),
      set: optStr(entry?.set),
      collectorNumber: optStr(entry?.collectorNumber),
    })),
  }));
  ipcMain.handle('carddb:printingsOf', (_e, name) =>
    cardsvc.call('printingsOf', { name: str(name) }));
  ipcMain.handle('carddb:searchPrefix', (_e, q) => cardsvc.call('searchPrefix', {
    query: str(q?.query),
    limit: Number.isInteger(q?.limit) ? Math.min(q.limit, 100) : 20,
  }));
  ipcMain.handle('carddb:searchFuzzy', (_e, q) => cardsvc.call('searchFuzzy', {
    query: str(q?.query),
    limit: Number.isInteger(q?.limit) ? Math.min(q.limit, 25) : 5,
  }));

  // ── Card art ──
  ipcMain.handle('images:status', () => cardsvc.call('imageQueueStatus'));
  ipcMain.handle('images:prefetch', (_e, req) => cardsvc.call('prefetchCards', {
    ids: idList(req?.ids, 400),
    tier: req?.tier === 'large' ? 'large' : 'png',
  }));
  ipcMain.handle('images:cancel', () => cardsvc.call('cancelImages'));

  // ── Decks ──
  // Ids only — the renderer never names a file. decks.cjs resolves an id inside
  // the decks folder via capability.resolveInsideDir and coerces every field on
  // the way in and out.
  ipcMain.handle('decks:list', () => decks.list());
  ipcMain.handle('decks:get', (_e, id) => decks.get(str(id)));
  ipcMain.handle('decks:save', (_e, deck) => decks.save(deck));
  ipcMain.handle('decks:delete', (_e, id) => decks.remove(str(id)));
  ipcMain.handle('decks:duplicate', (_e, id) => decks.duplicate(str(id)));
  ipcMain.handle('decks:rename', (_e, id, name) => decks.rename(str(id), str(name)));

  // Importing from a link. The renderer hands over a URL STRING and gets
  // decklist TEXT back — it never opens the connection itself, and deckfetch
  // rebuilds the URL from the deck slug it reads, so the channel can only ever
  // name a deck on an allowlisted host. See D92 and electron/deckfetch.cjs.
  ipcMain.handle('decks:fetchUrl', (_e, url) => deckfetch.fetchDeck(str(url)));

  // ── Multiplayer ──
  // ⚠️ The renderer opens the game socket ITSELF — the one deliberate exception
  // to rule 3 above (see netallow.cjs and D48). What main keeps is the decision
  // about WHICH origin: the renderer can ask for one, and main validates the
  // scheme, refuses plaintext `ws://` to a public address, and records it in
  // the `connect-src` allowlist. It can never name a host that has not been
  // through that check.
  ipcMain.handle('net:allowOrigin', (_e, url) => {
    const result = netallow.allow(str(url));
    // The CSP header is set when the document loads, so a brand-new origin only
    // takes effect after a reload. Saying so is what stops the renderer from
    // reporting "the host never answered" for a frame the browser refused.
    return { ok: result.ok, origin: result.origin, added: result.added, message: result.message };
  });
  ipcMain.handle('net:allowedOrigins', () => netallow.connectSources());
  ipcMain.handle('net:reload', (event) => {
    event.sender.reload();
    return true;
  });

  ipcMain.handle('lan:start', (_e, options) => lanServer.start({ code: str(options?.code) }));
  ipcMain.handle('lan:stop', () => lanServer.stop());
  ipcMain.handle('lan:status', () => lanServer.status());

  // Ids only — never a path. gamelog.cjs resolves inside <dataRoot>/games via
  // capability.resolveInsideDir, exactly as decks.cjs does.
  ipcMain.handle('gamelog:append', (_e, req) =>
    gamelog.append(str(req?.gameId), Array.isArray(req?.events) ? req.events : []));
  ipcMain.handle('gamelog:read', (_e, gameId) => gamelog.read(str(gameId)));
  ipcMain.handle('gamelog:list', () => gamelog.list());
  ipcMain.handle('gamelog:desync', (_e, record) =>
    gamelog.desync(record && typeof record === 'object' ? record : {}));
  ipcMain.handle('gamelog:desyncTail', () => gamelog.desyncTail());
}

module.exports = { registerIpc };
