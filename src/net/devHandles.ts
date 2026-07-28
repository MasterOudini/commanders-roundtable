// Dev handles for driving the M4 network layer from a CDP probe.
//
// ⚠️ EVERY SOCKET HERE IS OPENED BY BUNDLED CODE, never by a probe expression.
// The debugger bypasses page CSP — anything `Runtime.evaluate` runs is exempt,
// including a `<script>` it creates — so a probe that did `new WebSocket(url)`
// itself would report "allowed" for an origin the real CSP forbids. That
// discrepancy is measured in this project (D5) and it is exactly why
// `window.__crt.csp` exists. `tryConnect` below is the same idea for
// `connect-src`: the attempt happens inside the bundle, so the answer is the
// truth the app lives with.

import { exposeDevHandles } from '../devHandles';
import * as session from '../game/session';
import { replay, stateHash } from '../engine/log';
import { createOracleDb } from '../engine/oracle';
import { dropSocket, hostGame, joinGame } from '../game/multiplayer';
import { simplestIntent } from './testing/script';
import { RelayLink, whenReady } from './relayTransport';
import type { GameEvent } from '../engine/types/events';
import type { CardData } from '../data/cardTypes';

export type ConnectVerdict = 'open' | 'blocked' | 'refused' | 'timeout';

/**
 * Try to open a WebSocket, and say WHY it failed.
 *
 * ⚠️ MEASURE AT THE RIGHT LAYER (trap 10). The obvious implementation — "the
 * constructor throws, so it was CSP" — is wrong: Chromium does NOT throw for a
 * blocked `connect-src`, it fires the same `error` event a dead port fires. So
 * a probe written that way reports `refused` for a genuinely blocked origin and
 * cannot tell a security posture from an unplugged cable. What Chromium DOES do
 * is dispatch `securitypolicyviolation` on the document, naming the directive —
 * so that is what this listens for, and the socket outcome is only the fallback.
 */
function tryConnect(url: string, timeoutMs = 1500): Promise<ConnectVerdict> {
  return new Promise((resolve) => {
    let done = false;
    let socket: WebSocket | null = null;
    const onViolation = (event: SecurityPolicyViolationEvent): void => {
      if (!event.violatedDirective.startsWith('connect-src')) return;
      finish('blocked');
    };
    const finish = (verdict: ConnectVerdict): void => {
      if (done) return;
      done = true;
      document.removeEventListener('securitypolicyviolation', onViolation);
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // Already closing.
      }
      resolve(verdict);
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    document.addEventListener('securitypolicyviolation', onViolation);
    try {
      socket = new WebSocket(url);
    } catch {
      finish('blocked');
      return;
    }
    socket.onopen = () => finish('open');
    // ⚠️ A tick of slack before calling it `refused`: the violation event and the
    // socket's error event are dispatched in the same turn, and resolving on the
    // error first would mask the answer we actually want.
    socket.onerror = () => setTimeout(() => finish('refused'), 0);
  });
}

export function exposeNetHandles(): void {
  exposeDevHandles({
    net: {
      /** Can the renderer reach this origin at all, measured from inside the bundle? */
      tryConnect: (url: string, timeoutMs?: number) => tryConnect(url, timeoutMs),

      allowOrigin: (url: string) => window.crt?.net.allowOrigin(url) ?? null,
      allowedOrigins: () => window.crt?.net.allowedOrigins() ?? [],

      lanStart: (code = '') => window.crt?.lan.start(code) ?? null,
      lanStop: () => window.crt?.lan.stop() ?? null,
      lanStatus: () => window.crt?.lan.status() ?? null,

      /**
       * Replay the on-disk NDJSON log and compare its hash with the live game.
       *
       * ⚠️ THE ASSERTION THAT MAKES PERSISTENCE WORTH HAVING. A log that is
       * written but does not replay to the same state is worse than no log: it
       * looks like a backup and is not one.
       */
      verifyLog: async () => {
        const bridge = window.crt;
        const gameId = session.currentGameId();
        if (!bridge || gameId === '') return { ok: false, message: 'No game is running.' };
        const file = await bridge.gameLog.read(gameId);
        if (!file.ok) return { ok: false, message: 'No log on disk for this game.' };
        const events = file.events as GameEvent[];
        const seed = (events[0]?.body as { seed?: string } | undefined)?.seed ?? '';
        // ⚠️ The ACTIVE log, not history: a rewind truncates one and appends a
        // marker to the other, and only the active log replays to the live state.
        const active: GameEvent[] = [];
        for (const event of events) {
          if (event.body.t === 'RewoundTo') {
            active.length = Math.min(active.length, event.body.eventCount);
            continue;
          }
          active.push(event);
        }
        const state = replay(active, seed);
        const hash = stateHash(state);
        const live = session.stateHashNow();
        return {
          ok: true,
          gameId,
          lines: events.length,
          activeLines: active.length,
          liveEvents: session.eventCount(),
          truncated: file.truncated,
          replayHash: hash,
          liveHash: live,
          match: hash === live,
        };
      },

      /**
       * Host on the LAN and join it over a REAL socket from this same renderer.
       *
       * The second seat's `ClientSession` goes out through the loopback address
       * and back in through `electron/lanServer.cjs`, so every frame crosses a
       * real WebSocket under the real CSP — which is the one thing the in-process
       * tests cannot prove.
       */
      lanRoundTrip: async (timeoutMs = 8000) => {
        const bridge = window.crt;
        if (!bridge) return { ok: false, message: 'No app bridge.' };
        const lan = await bridge.lan.start('');
        if (!lan.running) return { ok: false, message: lan.message ?? 'The LAN listener did not start.' };
        const url = `ws://127.0.0.1:${lan.port}`;
        const link = new RelayLink({ url, code: lan.code, asHost: false, token: lan.token, maxBackoffMs: 300 });
        try {
          await whenReady(link, timeoutMs);
        } catch (err) {
          link.close();
          await bridge.lan.stop();
          return { ok: false, message: String(err) };
        }
        const connId = link.connId();
        link.close();
        await bridge.lan.stop();
        return { ok: true, url, connId, code: lan.code, addresses: lan.addresses.length };
      },

      /** Drop the live socket. See `RelayLink.dropSocket`. */
      dropSocket: () => dropSocket(),

      /** What the session believes about the game right now. */
      state: () => {
        const snapshot = session.current();
        return {
          running: snapshot.running,
          connected: snapshot.connected,
          hosting: snapshot.hosting,
          viewer: snapshot.viewer,
          seats: snapshot.seats.length,
          turn: snapshot.turn,
          priority: snapshot.priority,
          awaiting: snapshot.awaiting ? snapshot.awaiting.kind : null,
          events: snapshot.finished ? -1 : session.eventCount(),
          hash: session.stateHashNow(),
          message: snapshot.message,
          lobby: snapshot.lobby
            ? {
                code: snapshot.lobby.code,
                started: snapshot.lobby.started,
                seats: snapshot.lobby.seats.map((s) => ({
                  id: s.id,
                  name: s.name,
                  deck: s.deckName,
                  ready: s.ready,
                  connected: s.connected,
                })),
              }
            : null,
        };
      },

      /** A sanity check that the client's rehydration path builds a real oracle db. */
      poolSize: () => {
        const view = session.view();
        if (!view) return 0;
        const cards = Object.values(view.cards)
          .map((c) => c.card)
          .filter((c): c is CardData => c !== null);
        return createOracleDb(cards).size;
      },

    },

    /**
     * The multiplayer flow, as the screen drives it.
     *
     * ⚠️ These call the SAME functions the buttons call. A probe that
     * reimplemented hosting would prove the probe works; what needs proving is
     * that two real apps can find each other.
     */
    mp: {
      host: (opts: { mode?: 'lan' | 'relay'; deckId?: string | null }) =>
        hostGame({
          mode: opts.mode ?? 'lan',
          playerName: 'Probe host',
          deckId: opts.deckId ?? null,
        }),
      join: (opts: { url: string; code: string; token?: string; deckId?: string | null }) =>
        joinGame({
          url: opts.url,
          code: opts.code,
          ...(opts.token !== undefined && opts.token !== '' ? { token: opts.token } : {}),
          playerName: 'Probe guest',
          deckId: opts.deckId ?? null,
        }),
      ready: () => {
        session.setReady(true);
        return true;
      },
      start: () => session.hostSession()?.start() ?? { ok: false, message: 'Not hosting.' },
      /**
       * Take ONE action, if this app's seat has one to take.
       *
       * Returns false when it is somebody else's turn, which is what lets a
       * two-instance script alternate without knowing whose turn it is.
       */
      step: () => {
        const client = session.activeClient();
        if (!client) return false;
        const snapshot = client.snapshot();
        if (!snapshot.running || snapshot.finished) return false;
        const intent = simplestIntent(client, snapshot);
        if (!intent) return false;
        session.submit(intent);
        return true;
      },
    },
  });
}
