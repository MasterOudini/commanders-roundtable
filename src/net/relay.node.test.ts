import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { ClientSession } from './client';
import { viewHash } from '../engine/diffView';
import { HostSession } from './host';
import { RelayLink, whenReady } from './relayTransport';
import { loopbackPair } from './transport';
import type { Transport } from './transport';
import { FIXTURE_ORACLE_VERSION, fixtureDeck, fixtureResolver } from './testing/table';
import { playFrom } from './testing/script';
import type { TestTable } from './testing/table';

// The relay, over REAL sockets. Everything else in `net.test.ts` runs on
// loopback; this file is the one that proves the same sessions work when frames
// take a round trip, arrive out of band, and can stop arriving entirely.
//
// ⚠️ `.node.test.ts`, so it is type-checked by tsconfig.node.json where
// `types: ["node"]` is in force. Node 22+ ships a global `WebSocket`, so
// `SocketTransport` needs no injected factory here — the socket under test is
// the same class the renderer uses.

const require_ = createRequire(import.meta.url);
const { startRelay } = require_('../../relay/src/server.js') as typeof import('../../relay/src/server');

type Relay = ReturnType<typeof startRelay>;

const running: Relay[] = [];
const links: RelayLink[] = [];

afterEach(async () => {
  for (const link of links.splice(0)) link.close();
  for (const relay of running.splice(0)) await relay.close();
});

async function boot(port = 0): Promise<{ relay: Relay; port: number }> {
  const relay = startRelay({ log: () => undefined });
  running.push(relay);
  const actual = await relay.listen(port);
  return { relay, port: actual };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until `done()` or the deadline, so a test never sleeps longer than it must. */
async function until(done: () => boolean, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (done()) return true;
    await sleep(15);
  }
  return done();
}

interface RelayTable {
  host: HostSession;
  clients: { session: ClientSession; link: RelayLink; snapshots: number; errors: string[] }[];
  code: string;
}

/**
 * The PRODUCTION topology: the host's own player over a `loopbackPair`, every
 * guest over the relay.
 *
 * ⚠️ The host's relay connection is itself a room member, so a four-player game
 * is 1 host link + 3 guest links = 4 — exactly the relay's cap. Wiring the
 * host's own player through the relay as well makes it 5, and the fourth player
 * is refused with `roomFull` from a game that is not full. That is how this test
 * first failed, and it was the test that was wrong, not the cap.
 */
async function relayTable(port: number, names: string[], code = 'K7M2QX'): Promise<RelayTable> {
  const hostLink = new RelayLink({ url: `ws://127.0.0.1:${port}`, code, asHost: true, maxBackoffMs: 200 });
  links.push(hostLink);
  await whenReady(hostLink);

  const host = new HostSession({
    roomCode: hostLink.code(),
    hostName: names[0] ?? 'Host',
    gameId: 'g-relay',
    secret: 'relay-secret-0123456789',
    appVersion: '0.4.0-test',
    oracleVersion: FIXTURE_ORACLE_VERSION,
    seed: 'relay-seed',
    resolver: fixtureResolver,
    now: () => 1_700_000_000_000,
  });
  host.attach(hostLink);

  const clients: RelayTable['clients'] = [];
  for (const [i, name] of names.entries()) {
    const entry = {
      session: null as unknown as ClientSession,
      link: null as unknown as RelayLink,
      snapshots: 0,
      errors: [] as string[],
    };
    let transport: Transport;
    if (i === 0) {
      const pair = loopbackPair(hostLink.code(), 'local-0');
      host.attach(pair.host);
      transport = pair.client;
      entry.link = { close: () => pair.client.close() } as unknown as RelayLink;
    } else {
      const link = new RelayLink({
        url: `ws://127.0.0.1:${port}`,
        code: hostLink.code(),
        asHost: false,
        maxBackoffMs: 200,
      });
      links.push(link);
      await whenReady(link);
      transport = link;
      entry.link = link;
    }
    entry.session = new ClientSession(transport, {
      playerName: name,
      appVersion: '0.4.0-test',
      oracleVersion: FIXTURE_ORACLE_VERSION,
      onSnapshot: () => (entry.snapshots += 1),
      onError: (c) => entry.errors.push(c),
    });
    clients.push(entry);
  }
  await until(() => host.lobby().seats.length === names.length);
  return { host, clients, code: hostLink.code() };
}

async function startRelayGame(table: RelayTable): Promise<void> {
  for (const [i, client] of table.clients.entries()) client.session.submitDeck(fixtureDeck(i, 40));
  await until(() => table.host.lobby().seats.every((s) => s.deckName !== null));
  for (const client of table.clients) client.session.setReady(true);
  await until(() => table.host.lobby().seats.every((s) => s.ready));
  const result = table.host.start();
  expect(result.ok, result.message).toBe(true);
  await until(() => table.clients.every((c) => c.session.snapshot().running));
}

/** `playFrom` wants the loopback table's shape; the sessions are identical. */
function asTable(table: RelayTable): TestTable {
  return { clients: table.clients } as unknown as TestTable;
}

describe('the relay is a router and nothing else', () => {
  test('never imports the engine, the rules, or anything else from src/', () => {
    // ⚠️ A grep test, and it defends the single most important property the
    // relay has. The moment it can see the engine, somebody will "just check" a
    // rule in it, and the relay becomes a second source of truth.
    const dir = join(process.cwd(), 'relay');
    const files: string[] = [];
    const walk = (at: string): void => {
      for (const entry of readdirSync(at)) {
        if (entry === 'node_modules') continue;
        const full = join(at, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.js') || full.endsWith('.cjs') || full.endsWith('.mjs')) files.push(full);
      }
    };
    walk(dir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, `${file} reaches outside relay/`).not.toMatch(/require\(['"][^'"]*src[/\\]engine/);
      expect(text, `${file} reaches outside relay/`).not.toMatch(/require\(['"]\.\.[/\\]\.\./);
      expect(text, `${file} imports from the app`).not.toMatch(/from\s+['"][^'"]*src[/\\]/);
    }
  });

  test('serves a health endpoint and nothing else', async () => {
    const { port } = await boot();
    const ok = await fetch(`http://127.0.0.1:${port}/health`);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { ok: boolean }).ok).toBe(true);
    expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(404);
  });

  test('two rooms do not cross-talk', async () => {
    const { port } = await boot();
    const a = await relayTable(port, ['Ada', 'Bo'], 'AAAAAA');
    const b = await relayTable(port, ['Cy', 'Di'], 'BBBBBB');
    expect(a.code).toBe('AAAAAA');
    expect(b.code).toBe('BBBBBB');
    // Each host sees exactly its own two players, by name.
    expect(a.host.lobby().seats.map((s) => s.name)).toEqual(['Ada', 'Bo']);
    expect(b.host.lobby().seats.map((s) => s.name)).toEqual(['Cy', 'Di']);
    // ⚠️ Not merely "two rooms exist": each host must see NOBODY from the other.
    expect(a.host.lobby().seats.some((s) => s.name === 'Cy')).toBe(false);
    expect(b.host.lobby().seats.some((s) => s.name === 'Ada')).toBe(false);
  });

  test('a fifth connection to one room is refused by the relay itself', async () => {
    const { port } = await boot();
    await relayTable(port, ['Ada', 'Bo', 'Cy', 'Di']);
    const errors: string[] = [];
    const extra = new RelayLink({
      url: `ws://127.0.0.1:${port}`,
      code: 'K7M2QX',
      asHost: false,
      maxBackoffMs: 200,
      onRelayError: (code) => errors.push(code),
    });
    links.push(extra);
    // The host's link plus three guest links is already 4 members; the cap is a
    // room property, so the relay refuses BEFORE the host learns of the socket.
    await until(() => errors.length > 0);
    expect(errors).toContain('roomFull');
  });
});

describe('a four-player game over real sockets', () => {
  test('plays ten turns with every client agreeing with the host', async () => {
    const { port } = await boot();
    const table = await relayTable(port, ['Ada', 'Bo', 'Cy', 'Di']);
    await startRelayGame(table);

    // ⚠️ ONE INTENT PER SYNCHRONISED ROUND, which is what a human does: look at
    // the board, then click. Over a real socket a client's snapshot is a round
    // trip behind its own submit, so a loop that submits from every client every
    // few milliseconds produces a flood of intents chosen from boards that no
    // longer exist — all correctly rejected, all pointless, and the clients fall
    // 70 events behind while the test concludes the game never started. It did;
    // the test was reading its own backlog.
    const deadline = Date.now() + 120_000;
    let rounds = 0;
    while (Date.now() < deadline) {
      const synced = await until(
        () => table.clients.every((c) => c.session.snapshot().eventCount === table.host.eventCount()),
        5000,
      );
      expect(
        synced,
        `clients converge on the host between intents (host=${table.host.eventCount()} clients=${table.clients
          .map((c) => `${c.session.snapshot().you}:${c.session.snapshot().eventCount}`)
          .join(',')} round=${rounds})`,
      ).toBe(true);
      const snapshot = table.clients[0]?.session.snapshot();
      if (!snapshot || snapshot.finished || snapshot.turn.number > 5) break;
      // ⚠️ YIELD AFTER EVERY SUBMIT, unconditionally. Over an async transport
      // "every client's eventCount equals the host's" is true in the window
      // BEFORE an intent has been delivered, so a loop that only sleeps when it
      // could not act re-submits the same intent forever without ever letting
      // the event loop run. Measured: out of memory at the 4 GB heap limit, with
      // the same `MulliganDecision` submitted three thousand times.
      playFrom(asTable(table), 1);
      await sleep(2);
      rounds += 1;
    }
    // ⚠️ A LOWER BOUND ON THE DRIVER DOING WORK, not a measurement of the game.
    // How many intents it takes to reach turn 6 is a property of the stops
    // policy (`legal.ts`), and it halved when auto-pass stopped asking players
    // who could do nothing: the same five turns now cost 11 rounds rather than
    // 21. What this file is actually about — every client converging on the
    // host's event count between intents, and the view hashes below — is
    // unchanged, and the turn assertion after the loop is the coverage bar.
    expect(rounds).toBeGreaterThan(8);
    await until(() => table.clients.every((c) => c.session.snapshot().eventCount === table.host.eventCount()));

    expect(table.clients[0]?.session.snapshot().turn.number ?? 0).toBeGreaterThan(3);
    for (const client of table.clients) {
      const you = client.session.snapshot().you;
      const fresh = table.host.viewOf(you);
      expect(fresh).not.toBeNull();
      expect(viewHash(client.session.currentView())).toBe(viewHash(fresh as never));
    }
  }, 120_000);

  test('killing and restarting the relay mid-game lets every client resync', async () => {
    // ⚠️ INJECT THE FAILURE YOU CLAIM TO SURVIVE. `injectHungBeat()` exists in
    // the choreographer for the same reason: a queue that cannot survive one
    // hung beat strands a real player, and a transport that cannot survive one
    // relay restart loses a real game.
    const { relay, port } = await boot();
    const table = await relayTable(port, ['Ada', 'Bo']);
    await startRelayGame(table);
    const warmup = Date.now() + 20_000;
    while (Date.now() < warmup && (table.clients[0]?.session.snapshot().turn.number ?? 0) < 2) {
      playFrom(asTable(table), 4);
      await sleep(4);
    }
    await until(() => table.clients.every((c) => c.session.snapshot().eventCount === table.host.eventCount()));

    const snapshotsBefore = table.clients.map((c) => c.snapshots);
    const hashBefore = table.host.hash();
    // ⚠️ Client 0 is the HOST'S OWN player, on a loopback pair. It has no socket
    // to lose, so it must NOT resync — and asserting that it does is how this
    // test first failed. The relay outage is invisible to it, which is the point.
    const remote = table.clients.slice(1);
    expect(remote.length).toBeGreaterThan(0);

    // The relay dies. It holds no game state, so there is nothing to lose —
    // which is exactly the property that makes this recoverable at all.
    await relay.close();
    running.length = 0;
    await sleep(50);

    // …and comes back on the same port, with no memory of the room.
    const again = startRelay({ log: () => undefined });
    running.push(again);
    await again.listen(port);

    const back = await until(
      () => remote.every((c, i) => c.snapshots > (snapshotsBefore[i + 1] ?? 0)),
      30_000,
    );
    expect(back, 'every remote client resynced after the relay came back').toBe(true);
    expect(table.clients[0]?.snapshots).toBe(snapshotsBefore[0]);

    // The room code the players are looking at still works, the host still
    // holds the same game, and everybody agrees again.
    expect(table.host.hash()).toBe(hashBefore);
    for (const client of table.clients) {
      const you = client.session.snapshot().you;
      expect(viewHash(client.session.currentView())).toBe(viewHash(table.host.viewOf(you) as never));
    }

    // And play continues.
    const before = table.host.eventCount();
    const playDeadline = Date.now() + 20_000;
    while (Date.now() < playDeadline && table.host.eventCount() === before) {
      playFrom(asTable(table), 4);
      await sleep(10);
    }
    expect(table.host.eventCount()).toBeGreaterThan(before);
  }, 120_000);

  test('a client whose own socket dies rejoins on its resumeToken alone', async () => {
    const { port } = await boot();
    const table = await relayTable(port, ['Ada', 'Bo', 'Cy']);
    await startRelayGame(table);
    const warmup = Date.now() + 20_000;
    while (Date.now() < warmup && (table.clients[0]?.session.snapshot().turn.number ?? 0) < 2) {
      playFrom(asTable(table), 4);
      await sleep(4);
    }
    await until(() => table.clients.every((c) => c.session.snapshot().eventCount === table.host.eventCount()));

    const victim = table.clients[2];
    if (!victim) throw new Error('no third client');
    const token = victim.session.resumeToken();
    const seatsBefore = victim.snapshots;
    victim.link.close('socket died');

    await until(() => table.host.lobby().seats[2]?.connected === false);
    expect(table.host.lobby().seats[2]?.connected).toBe(false);

    const link = new RelayLink({ url: `ws://127.0.0.1:${port}`, code: table.code, asHost: false, maxBackoffMs: 200 });
    links.push(link);
    await whenReady(link);
    let snapshots = 0;
    const rejoined = new ClientSession(link, {
      playerName: 'Cy',
      appVersion: '0.4.0-test',
      oracleVersion: FIXTURE_ORACLE_VERSION,
      ...(token !== null ? { resumeToken: token } : {}),
      onSnapshot: () => (snapshots += 1),
    });
    await until(() => snapshots > 0);
    expect(snapshots).toBe(1);
    expect(seatsBefore).toBeGreaterThan(0);
    expect(rejoined.snapshot().you).toBe('p3');
    expect(viewHash(rejoined.currentView())).toBe(viewHash(table.host.viewOf('p3') as never));
    await until(() => table.host.lobby().seats[2]?.connected === true);
    expect(table.host.lobby().seats[2]?.connected).toBe(true);
  }, 60_000);
});
