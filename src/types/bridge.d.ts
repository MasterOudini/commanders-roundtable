// Types for the preload bridge (electron/preload.cjs).
//
// ⚠️ This file and electron/preload.cjs are the SAME contract — change both
// together. A mismatch here is invisible until runtime.

import type { CardData } from '../data/cardTypes';
import type { DeckFile } from '../data/deckTypes';

export interface DeckSummary {
  id: string;
  name: string;
  updatedAt: string;
  /** Commanders + main, by quantity. */
  cardCount: number;
  commanderNames: string[];
  houseRuled: boolean;
}

/**
 * A decklist downloaded from a deck site. TEXT, not a deck: it goes through the
 * same parser and the same preview a pasted list does, and nothing is saved
 * until the user says so.
 */
export type FetchedDecklist =
  | {
    ok: true;
    site: 'tappedout' | 'moxfield' | 'archidekt';
    /** The deck's own page, rebuilt from the id in the pasted link. */
    sourceUrl: string;
    /** What the deck is called on the site. Empty when the site did not say. */
    name: string;
    text: string;
    /**
     * False when the download carried no Commander section — the list is
     * complete, but which card is the commander has to be chosen by hand.
     */
    commanderKnown: boolean;
  }
  | { ok: false; code: string; message: string };

export type AnimationSpeed = 'cinematic' | 'brisk' | 'fast' | 'off';
export type ImageTier = 'png' | 'large';

export interface AppInfo {
  name: string;
  version: string;
  isDev: boolean;
  isPackaged: boolean;
  platform: string;
  dataRoot: string;
  versions: { electron: string; chrome: string; node: string };
}

export interface AllowOriginResult {
  ok: boolean;
  origin: string;
  /** True when the current document's CSP predates this origin — reload first. */
  added: boolean;
  message: string;
}

export interface LanAddress {
  name: string;
  address: string;
  url: string;
}

export interface LanStatus {
  running: boolean;
  code: string;
  /** 128 bits the guests must present. Only the host's own screen shows it. */
  token: string;
  port: number;
  addresses: LanAddress[];
  ok?: boolean;
}

export interface GameLogSummary {
  gameId: string;
  bytes: number;
  updatedAt: string;
}

export interface Settings {
  playerName: string;
  relayUrl: string;
  /** Validated ws:// / wss:// origins the renderer may open a socket to. */
  allowedOrigins: string[];
  animationSpeed: AnimationSpeed;
  autoTapMana: boolean;
  prefetchArtOnImport: boolean;
  imageTier: ImageTier;
}

export type UpdaterState =
  | 'idle'
  | 'disabled'
  | 'skipped'
  | 'unavailable'
  | 'checking'
  | 'current'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdaterStatus {
  state: UpdaterState;
  version: string | null;
  message: string | null;
}

/** Unsubscribe closure returned by every on* subscription. */
export type Unsubscribe = () => void;

/**
 * 'absent'     nothing downloaded yet
 * 'downloaded' bulk file present and verified, index not built yet
 * 'ready'      queryable
 */
export type CardDbState = 'absent' | 'downloaded' | 'ready' | 'unknown';

/** Supervisor state, separate from the on-disk state above. */
export type CardDbWorkerState = 'not-started' | 'starting' | 'ready' | 'crashed' | 'stopped';

export interface CardDbStatus {
  state: CardDbState;
  /** What the worker is doing right now. */
  phase: 'idle' | 'manifest' | 'download' | 'verify' | 'transform';
  worker: CardDbWorkerState;
  restarts: number;
  dataset?: string;
  /** Scryfall's release timestamp for the data we hold. */
  updatedAt?: string;
  downloadedAt?: string;
  transformedAt?: string | null;
  cardCount?: number | null;
  bulkBytes?: number | null;
  bulkLines?: number | null;
  /** Age of the held data in days; drives the "your card data is stale" warning. */
  ageDays?: number | null;
  error?: string;
}

export interface CardIndexStats {
  cardCount: number;
  uniqueNames: number;
  loadMs: number;
  /** True when the index was rebuilt from the NDJSON rather than a full sync. */
  rebuilt: boolean;
}

export interface CardNameQuery {
  name: string;
  /** Set code from a decklist line like `1 Sol Ring (LTC) 264`. */
  set?: string;
  collectorNumber?: string;
}

export interface ResolvedName {
  name: string;
  card: CardData | null;
  /** Present only when `card` is null. */
  suggestions?: string[];
}

export interface CardDbProgress {
  t: 'progress';
  phase: 'manifest' | 'download' | 'verify' | 'transform' | 'images' | 'idle';
  message?: string;
  received?: number;
  total?: number;
  resumedFrom?: number;
  reused?: boolean;
  /** phase 'images': how many of `total` have been settled. */
  saved?: number;
  failed?: number;
  pending?: number;
  done?: number | boolean;
}

export interface ImageQueueStatus {
  pending: number;
  /** Transient failures awaiting a retry. */
  failed: number;
  /** Permanent failures (a 404 means that tier/face genuinely has no image). */
  dead: number;
  running: boolean;
  cache: { bytes: number; files: number };
}

export interface ImagePrefetchResult {
  added: number;
  alreadyCached: number;
  skippedDead: number;
  /** How many images the deck needs in total (crops + full art, de-duplicated). */
  wanted: number;
  cards: number;
  /** Set when the request was refused for being unreasonably large. */
  refused?: string;
}

export interface CrtBridge {
  app: {
    info: () => Promise<AppInfo>;
    showDataFolder: () => Promise<boolean>;
  };
  settings: {
    get: () => Promise<Settings>;
    set: (patch: Partial<Settings>) => Promise<Settings>;
    defaults: () => Promise<Settings>;
  };
  updater: {
    status: () => Promise<UpdaterStatus>;
    onStatus: (cb: (status: UpdaterStatus) => void) => Unsubscribe;
  };
  cardDb: {
    status: () => Promise<CardDbStatus>;
    sync: (options?: { force?: boolean }) => Promise<CardDbStatus & { alreadyCurrent?: boolean }>;
    cancel: () => Promise<{ cancelled: boolean; reason?: string }>;
    restart: () => Promise<{ restarted: boolean }>;
    logTail: () => Promise<string>;
    onProgress: (cb: (progress: CardDbProgress) => void) => Unsubscribe;
    onState: (cb: (s: { state: CardDbWorkerState; restarts: number }) => void) => Unsubscribe;

    indexStats: () => Promise<CardIndexStats>;
    byId: (id: string) => Promise<CardData | null>;
    /** Names are sent as typed; the worker owns the folding rules. */
    byName: (query: CardNameQuery) => Promise<CardData | null>;
    /** One call for a whole decklist. Unresolved entries come back with suggestions. */
    resolveNames: (entries: CardNameQuery[]) => Promise<ResolvedName[]>;
    printingsOf: (name: string) => Promise<CardData[]>;
    hydrate: (ids: string[]) => Promise<CardData[]>;
    searchPrefix: (query: string, limit?: number) => Promise<CardData[]>;
    /** Suggestions only — never used to silently substitute a card. */
    searchFuzzy: (query: string, limit?: number) => Promise<CardData[]>;
  };
  decks: {
    list: () => Promise<DeckSummary[]>;
    get: (id: string) => Promise<DeckFile | null>;
    /** Omit `id` to create. Returns the saved deck, with its id filled in. */
    save: (deck: Partial<DeckFile>) => Promise<DeckFile | null>;
    /** Moves the file to decks/trash/ rather than unlinking it. */
    delete: (id: string) => Promise<boolean>;
    duplicate: (id: string) => Promise<DeckFile | null>;
    rename: (id: string, name: string) => Promise<DeckFile | null>;
    /**
     * Download a decklist by link (Moxfield, Archidekt or TappedOut). Main opens
     * the connection — the renderer only ever names a deck, never a URL it could
     * reach itself. Resolves with a result object; it does not reject for a bad
     * link.
     */
    fetchUrl: (url: string) => Promise<FetchedDecklist>;
  };
  net: {
    /**
     * Ask main to allow a WebSocket origin in the renderer's `connect-src`.
     *
     * ⚠️ `added: true` means the CSP for the CURRENT document does not include
     * it — the header is set at document load, so reload before connecting.
     * Skipping that gives a socket the browser refuses, which reads as "the host
     * never answered".
     */
    allowOrigin: (url: string) => Promise<AllowOriginResult>;
    allowedOrigins: () => Promise<string[]>;
    reload: () => Promise<boolean>;
  };
  lan: {
    /** Bind the local network for as long as this game runs. */
    start: (code: string) => Promise<LanStatus & { message?: string }>;
    stop: () => Promise<{ running: boolean }>;
    status: () => Promise<LanStatus>;
  };
  gameLog: {
    append: (gameId: string, events: unknown[]) => Promise<{ ok: boolean; written: number; message: string }>;
    read: (gameId: string) => Promise<{ ok: boolean; events: unknown[]; truncated: boolean }>;
    list: () => Promise<GameLogSummary[]>;
    desync: (record: unknown) => Promise<{ ok: boolean }>;
    desyncTail: () => Promise<unknown[]>;
  };
  images: {
    status: () => Promise<ImageQueueStatus>;
    /**
     * Queue art for these cards by scryfall id. Resolves once the work is
     * QUEUED — a deck's art takes minutes. Watch cardDb.onProgress for
     * `phase: 'images'` updates.
     */
    prefetch: (ids: string[], tier?: ImageTier) => Promise<ImagePrefetchResult>;
    cancel: () => Promise<{ cancelled: boolean; reason?: string }>;
  };
}

declare global {
  interface Window {
    /** Present only inside Electron; undefined in a plain browser dev session. */
    crt?: CrtBridge;
  }
}
