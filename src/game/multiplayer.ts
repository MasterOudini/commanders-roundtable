// Hosting and joining a game over a real transport.
//
// ⚠️ THE THREE TRANSPORTS ARE ONE CODE PATH. Loopback (solo), LAN (a listener
// inside this app) and relay (a router on a VPS) all end in the same
// `RelayLink`/`loopbackPair` handed to the same `HostSession` and
// `ClientSession`. The only differences live in this file: where the socket
// points, and who mints the room code.
//
// ⚠️ THE ORDER MATTERS AND IS NOT OBVIOUS. A new WebSocket origin has to be in
// the renderer's `connect-src` BEFORE the document that opens it was loaded, so
// `allowOrigin` may report `added: true` — meaning "reload first". Connecting
// anyway gives a socket the browser silently refuses, which the session reports
// as "the host never answered". Every entry point below checks it.

import { ClientSession } from '../net/client';
import { HostSession } from '../net/host';
import { RelayLink, whenReady } from '../net/relayTransport';
import { loopbackPair } from '../net/transport';
import { newGameSeed, normaliseRoomCode, type DeckSubmission } from '../net/protocol';
import { seatFromDeck, starterSeat, TOKEN_NAMES, type CardResolver } from './buildGame';
import * as session from './session';
import { oracleVersion } from './solo';
import type { CardData } from '../data/cardTypes';
import type { DeckFile } from '../data/deckTypes';

/**
 * The live network link, if this app has one.
 *
 * Module-level rather than passed around: exactly one game is joinable at a
 * time (the table screen is a singleton), and the alternative is threading a
 * transport through the session for the benefit of one dev handle.
 */
let liveLink: RelayLink | null = null;

/** Drop the socket under a live game, so a probe can prove reconnect works. */
export function dropSocket(): boolean {
  if (!liveLink) return false;
  liveLink.dropSocket();
  return true;
}

export interface JoinInfo {
  readonly url: string;
  readonly code: string;
  readonly token?: string;
}

export interface HostResult {
  readonly ok: boolean;
  readonly message: string;
  readonly join: JoinInfo | null;
  /** Every address a guest on this network could type. Empty for a relay game. */
  readonly addresses: readonly { readonly name: string; readonly url: string }[];
  /** True when the caller must reload before this will work. */
  readonly needsReload: boolean;
}

function resolver(): CardResolver | null {
  const bridge = window.crt;
  if (!bridge) return null;
  return {
    async byName(name, set, collectorNumber) {
      return bridge.cardDb.byName({
        name,
        ...(set !== undefined ? { set } : {}),
        ...(collectorNumber !== undefined ? { collectorNumber } : {}),
      });
    },
    async many(entries) {
      const results = await bridge.cardDb.resolveNames(
        entries.map((e) => ({
          name: e.name,
          ...(e.set !== undefined ? { set: e.set } : {}),
          ...(e.collectorNumber !== undefined ? { collectorNumber: e.collectorNumber } : {}),
        })),
      );
      return results.map((r) => r.card);
    },
  };
}

/** Token printings, so the Tier-3 tools work in a networked game too. */
async function loadTokens(): Promise<CardData[]> {
  const bridge = window.crt;
  if (!bridge) return [];
  const out: CardData[] = [];
  for (const name of TOKEN_NAMES) {
    try {
      const printings = await bridge.cardDb.printingsOf(name);
      const token = printings.find((c) => c.layout === 'token');
      if (token) out.push(token);
    } catch {
      // A missing token is not worth failing a game over.
    }
  }
  return out;
}

/** Turn a saved deck (or a starter) into a `DeckSubmission`. */
export async function deckSubmission(
  deckId: string | null,
  seatIndex: number,
): Promise<{ deck: DeckSubmission; issues: string[] } | null> {
  const cards = resolver();
  const bridge = window.crt;
  if (!cards || !bridge) return null;
  if (deckId) {
    const file: DeckFile | null = await bridge.decks.get(deckId);
    if (file) {
      const built = await seatFromDeck('p?', file.name, file, cards);
      return {
        deck: {
          name: file.name,
          commanders: built.seat.commanders.map((c) => ({ oracleId: c.oracleId, printingId: c.scryfallId })),
          mainDeck: built.seat.library.map((c) => ({ oracleId: c.oracleId, printingId: c.scryfallId })),
        },
        issues: built.missing.map((n) => `"${n}" is not in your card database and was left out.`),
      };
    }
  }
  const starter = await starterSeat('p?', 'Starter', seatIndex, cards);
  return {
    deck: {
      name: 'Starter deck',
      commanders: starter.commanders.map((c) => ({ oracleId: c.oracleId, printingId: c.scryfallId })),
      mainDeck: starter.library.map((c) => ({ oracleId: c.oracleId, printingId: c.scryfallId })),
    },
    issues: [],
  };
}

export interface HostOptions {
  readonly mode: 'lan' | 'relay';
  readonly playerName: string;
  readonly relayUrl?: string;
  readonly deckId: string | null;
}

/** Start hosting. Returns what the other players need to type. */
export async function hostGame(opts: HostOptions): Promise<HostResult> {
  const bridge = window.crt;
  if (!bridge) {
    return { ok: false, message: 'Multiplayer needs the desktop app.', join: null, addresses: [], needsReload: false };
  }
  session.stop();

  let url: string;
  let code: string;
  let token: string | undefined;
  let addresses: { name: string; url: string }[] = [];

  if (opts.mode === 'lan') {
    // Empty: the LISTENER mints the code, exactly as the relay does. Two places
    // inventing room codes is two places for them to stop matching.
    const lan = await bridge.lan.start('');
    if (!lan.running) {
      return { ok: false, message: lan.message ?? 'The LAN listener did not start.', join: null, addresses: [], needsReload: false };
    }
    url = `ws://127.0.0.1:${lan.port}`;
    code = lan.code;
    token = lan.token;
    addresses = lan.addresses.map((a) => ({ name: a.name, url: a.url }));
  } else {
    const relay = (opts.relayUrl ?? '').trim();
    if (relay === '') {
      return {
        ok: false,
        message: 'Set a relay address in Settings first, or host over your local network instead.',
        join: null,
        addresses: [],
        needsReload: false,
      };
    }
    const allowed = await bridge.net.allowOrigin(relay);
    if (!allowed.ok) return { ok: false, message: allowed.message, join: null, addresses: [], needsReload: false };
    if (allowed.added) {
      return {
        ok: false,
        message: 'That relay is now allowed. Reload the app once, then host again.',
        join: null,
        addresses: [],
        needsReload: true,
      };
    }
    url = relay;
    code = '';
  }

  const link = new RelayLink({
    url,
    code,
    asHost: true,
    ...(token !== undefined ? { token } : {}),
  });
  try {
    await whenReady(link);
  } catch (err) {
    link.close();
    if (opts.mode === 'lan') await bridge.lan.stop();
    return { ok: false, message: String(err instanceof Error ? err.message : err), join: null, addresses: [], needsReload: false };
  }

  const seed = newGameSeed();
  const gameId = `g-${seed}`;
  const info = await bridge.app.info().catch(() => null);
  const host = new HostSession({
    roomCode: link.code(),
    hostName: opts.playerName,
    gameId,
    secret: newGameSeed() + newGameSeed(),
    appVersion: info?.version ?? '0.0.0',
    oracleVersion: await oracleVersion(),
    seed,
    extraPool: await loadTokens(),
    resolver: {
      async resolve(ids) {
        const out = new Map<string, CardData>();
        for (const card of await bridge.cardDb.hydrate([...ids])) out.set(card.scryfallId, card);
        return out;
      },
    },
    onEvents: (events) => {
      void bridge.gameLog.append(gameId, [...events]).catch(() => undefined);
    },
    onDesync: (record) => {
      void bridge.gameLog.desync({ side: 'host', gameId, ...record }).catch(() => undefined);
    },
  });
  host.attach(link);
  liveLink = link;

  // The host's own player, over a loopback pair — exactly like a guest.
  const pair = loopbackPair(link.code(), 'local-host');
  host.attach(pair.host);
  const hooks = session.clientHooks('p1');
  const client = new ClientSession(pair.client, {
    playerName: opts.playerName,
    appVersion: info?.version ?? '0.0.0',
    oracleVersion: await oracleVersion(),
    onBatch: hooks.onBatch,
    onSnapshot: hooks.onSnapshot,
    onDesync: hooks.onDesync,
  });
  session.beginHosting({ host, gameId, playerId: client.snapshot().you, client });

  const submission = await deckSubmission(opts.deckId, 0);
  if (submission) client.submitDeck(submission.deck);

  return {
    ok: true,
    message: `Hosting. Share the code ${link.code()}.`,
    join: { url, code: link.code(), ...(token !== undefined ? { token } : {}) },
    addresses,
    needsReload: false,
  };
}

export interface JoinOptions {
  readonly url: string;
  readonly code: string;
  readonly token?: string;
  readonly playerName: string;
  readonly deckId: string | null;
}

export interface JoinResult {
  readonly ok: boolean;
  readonly message: string;
  readonly needsReload: boolean;
}

export async function joinGame(opts: JoinOptions): Promise<JoinResult> {
  const bridge = window.crt;
  if (!bridge) return { ok: false, message: 'Multiplayer needs the desktop app.', needsReload: false };
  const code = normaliseRoomCode(opts.code);
  if (code.length !== 6) {
    return { ok: false, message: 'A room code is six characters. Ask the host to read it out again.', needsReload: false };
  }

  const allowed = await bridge.net.allowOrigin(opts.url);
  if (!allowed.ok) return { ok: false, message: allowed.message, needsReload: false };
  if (allowed.added) {
    // ⚠️ See the header: the CSP for THIS document predates the origin, so the
    // socket would be refused by the browser and look like a silent host.
    return {
      ok: false,
      message: "That address is now allowed. Reload the app once, then join again.",
      needsReload: true,
    };
  }

  session.stop();
  const info = await bridge.app.info().catch(() => null);
  const link = new RelayLink({
    url: opts.url,
    code,
    asHost: false,
    ...(opts.token !== undefined && opts.token !== '' ? { token: opts.token } : {}),
  });
  try {
    await whenReady(link);
  } catch (err) {
    link.close();
    return { ok: false, message: String(err instanceof Error ? err.message : err), needsReload: false };
  }

  liveLink = link;
  const hooks = session.clientHooks('guest');
  const client = new ClientSession(link, {
    playerName: opts.playerName,
    appVersion: info?.version ?? '0.0.0',
    oracleVersion: await oracleVersion(),
    onBatch: hooks.onBatch,
    onSnapshot: hooks.onSnapshot,
    onDesync: hooks.onDesync,
  });
  session.beginGuest(client, `joined-${code}`);

  const submission = await deckSubmission(opts.deckId, 1);
  if (submission) client.submitDeck(submission.deck);

  return { ok: true, message: `Joined ${code}.`, needsReload: false };
}
