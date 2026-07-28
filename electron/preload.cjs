const { contextBridge, ipcRenderer } = require('electron');

// The renderer's ONLY bridge to the main process. Keep this surface small and
// task-shaped — never expose raw ipcRenderer, and never a generic
// readFile/writeFile. Every handler behind it is capability-gated in main.
//
// Event subscriptions return their own unsubscribe closure so a React effect
// can clean up without needing a removeListener API of its own.
function subscribe(channel) {
  return (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('crt', {
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    showDataFolder: () => ipcRenderer.invoke('app:showDataFolder'),
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    defaults: () => ipcRenderer.invoke('settings:defaults'),
  },

  updater: {
    status: () => ipcRenderer.invoke('updater:status'),
    onStatus: subscribe('updater:status'),
  },

  cardDb: {
    status: () => ipcRenderer.invoke('carddb:status'),
    sync: (options) => ipcRenderer.invoke('carddb:sync', options),
    cancel: () => ipcRenderer.invoke('carddb:cancel'),
    restart: () => ipcRenderer.invoke('carddb:restart'),
    logTail: () => ipcRenderer.invoke('carddb:logTail'),
    onProgress: subscribe('carddb:progress'),
    onState: subscribe('carddb:state'),

    // Queries. Names are sent as the user typed them — the worker owns the
    // folding rules, so the renderer never normalises anything itself.
    indexStats: () => ipcRenderer.invoke('carddb:indexStats'),
    byId: (id) => ipcRenderer.invoke('carddb:byId', id),
    byName: (query) => ipcRenderer.invoke('carddb:byName', query),
    resolveNames: (entries) => ipcRenderer.invoke('carddb:resolveNames', entries),
    printingsOf: (name) => ipcRenderer.invoke('carddb:printingsOf', name),
    hydrate: (ids) => ipcRenderer.invoke('carddb:hydrate', ids),
    searchPrefix: (query, limit) => ipcRenderer.invoke('carddb:searchPrefix', { query, limit }),
    searchFuzzy: (query, limit) => ipcRenderer.invoke('carddb:searchFuzzy', { query, limit }),
  },

  decks: {
    list: () => ipcRenderer.invoke('decks:list'),
    get: (id) => ipcRenderer.invoke('decks:get', id),
    save: (deck) => ipcRenderer.invoke('decks:save', deck),
    delete: (id) => ipcRenderer.invoke('decks:delete', id),
    duplicate: (id) => ipcRenderer.invoke('decks:duplicate', id),
    rename: (id, name) => ipcRenderer.invoke('decks:rename', id, name),
    /** Download a decklist by link. Returns TEXT to import — nothing is saved. */
    fetchUrl: (url) => ipcRenderer.invoke('decks:fetchUrl', url),
  },

  net: {
    /**
     * Ask main to allow a WebSocket origin. `added: true` means the CSP for the
     * CURRENT document does not include it yet — reload before connecting.
     */
    allowOrigin: (url) => ipcRenderer.invoke('net:allowOrigin', url),
    allowedOrigins: () => ipcRenderer.invoke('net:allowedOrigins'),
    reload: () => ipcRenderer.invoke('net:reload'),
  },

  lan: {
    start: (code) => ipcRenderer.invoke('lan:start', { code }),
    stop: () => ipcRenderer.invoke('lan:stop'),
    status: () => ipcRenderer.invoke('lan:status'),
  },

  gameLog: {
    append: (gameId, events) => ipcRenderer.invoke('gamelog:append', { gameId, events }),
    read: (gameId) => ipcRenderer.invoke('gamelog:read', gameId),
    list: () => ipcRenderer.invoke('gamelog:list'),
    desync: (record) => ipcRenderer.invoke('gamelog:desync', record),
    desyncTail: () => ipcRenderer.invoke('gamelog:desyncTail'),
  },

  images: {
    status: () => ipcRenderer.invoke('images:status'),
    /** Queue art for these cards (by scryfall id). Returns once QUEUED, not done. */
    prefetch: (ids, tier) => ipcRenderer.invoke('images:prefetch', { ids, tier }),
    cancel: () => ipcRenderer.invoke('images:cancel'),
  },
});
