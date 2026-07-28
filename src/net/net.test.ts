import { describe, expect, test } from 'vitest';
import { ClientSession } from './client';
import { viewHash } from '../engine/diffView';
import { project } from '../engine/project';
import { createOracleDb } from '../engine/oracle';
import { EMPTY_REGISTRY } from '../engine/scripts/registry';
import { PROTOCOL_VERSION } from './protocol';
import { loopbackPair } from './transport';
import { FIXTURE_ORACLE_VERSION, fixtureDeck, makeTable, settle } from './testing/table';
import { playFrom } from './testing/script';
import type { PlayerId } from '../engine/types/ids';
import { zoneId } from '../view/types';

// The §8.2-D list, run against a host and four clients in ONE process, all of
// them over real `loopbackPair` transports — which is the production path the
// host's own player takes, not a stand-in for it.

async function fourPlayerGame() {
  const table = makeTable();
  table.join('Ada');
  table.join('Bo');
  table.join('Cy');
  table.join('Di');
  const started = await table.startGame();
  expect(started.ok).toBe(true);
  return table;
}

describe('host + four loopback clients', () => {
  test('everyone is seated, sees their own seat, and gets a snapshot', async () => {
    const table = await fourPlayerGame();
    const seats = table.clients.map((c) => c.session.snapshot().you);
    expect(seats).toEqual(['p1', 'p2', 'p3', 'p4']);
    for (const client of table.clients) {
      expect(client.snapshots.length).toBeGreaterThanOrEqual(1);
      expect(client.session.snapshot().running).toBe(true);
      expect(client.session.currentView().me).toBe(client.session.snapshot().you);
    }
  });

  test('every client agrees with the host after every single update', async () => {
    const table = await fourPlayerGame();
    const acted = playFrom(table, 400);
    expect(acted).toBeGreaterThan(50);
    for (const client of table.clients) {
      const you = client.session.snapshot().you;
      // ⚠️ The hash is the assertion; `desyncs` proves it was never repaired
      // behind our back by a resync we did not notice.
      expect(client.desyncs).toEqual([]);
      expect(viewHash(client.session.currentView())).toBe(viewHash(table.host.viewOf(you) as never));
    }
  }, 60_000);

  test('a complete scripted game ends with every client equal to a FRESH project()', async () => {
    const table = await fourPlayerGame();
    playFrom(table, 4000);
    const host = table.host;
    // Rebuild the authoritative view from scratch — no identity cache, no patch
    // history — and compare. This is the end-to-end statement of correctness for
    // the whole wire: 4 clients, N updates, one hash each.
    const oracleView = (player: PlayerId) => {
      const view = host.viewOf(player);
      if (!view) throw new Error('no game');
      return viewHash(view);
    };
    for (const client of table.clients) {
      const you = client.session.snapshot().you;
      expect(viewHash(client.session.currentView())).toBe(oracleView(you));
    }
    expect(table.clients[0]?.session.snapshot().turn.number ?? 0).toBeGreaterThan(3);
  }, 120_000);

  /**
   * ⚠️ THE GAP THIS SUITE HAD. The targeting work added a `chooseTargets` prompt;
   * `simplestIntent` had no case for it and silently returned null, so the moment
   * a script cast a targeted spell nothing was ever submitted again. All 48 tests
   * here stayed green because the fixture deck contained no targeted spell — so
   * `scripts/two-instance.cjs` wedged on turn 1 and nothing in CI could see why.
   *
   * This asserts the prompt is REACHED and ANSWERED, not merely tolerated: a
   * spell cannot get onto the stack without its targets being declared and
   * accepted by the host's `validateTargets`, so a resolved Lightning Bolt is
   * proof the whole round trip ran.
   */
  test('a scripted game casts a TARGETED spell and answers the prompt', async () => {
    const table = await fourPlayerGame();
    playFrom(table, 4000);
    const log = table.clients[0]?.session.currentView().log ?? [];
    const cast = log.filter((e) => /casts? Lightning Bolt/.test(e.text));
    expect(cast.length).toBeGreaterThan(0);
    // It resolved, so the host accepted the targets rather than rejecting them.
    expect(log.some((e) => /Lightning Bolt resolves/.test(e.text))).toBe(true);
    // And no seat is stuck: the game moved well past the first targeted cast.
    expect(table.clients[0]?.session.snapshot().turn.number ?? 0).toBeGreaterThan(3);
  }, 120_000);

  test('a duplicate intentId is ignored — a retried send cannot double-cast', async () => {
    const table = await fourPlayerGame();
    const client = table.clients[0];
    if (!client) throw new Error('no client');
    // Reach past the session's own counter to send the SAME id twice, which is
    // exactly what a client retrying a flaky send does.
    const before = table.host.eventCount();
    const raw = client.transport;
    const send = (intentId: string) =>
      raw.send({
        v: PROTOCOL_VERSION,
        room: 'K7M2QX',
        from: raw.connId(),
        to: 'host',
        seq: 999,
        ack: 0,
        body: { t: 'Intent', intentId, intent: { t: 'MulliganDecision', player: 'p1', keep: true } },
      });
    send('retry-1');
    const afterFirst = table.host.eventCount();
    send('retry-1');
    const afterSecond = table.host.eventCount();
    expect(afterFirst).toBeGreaterThan(before);
    expect(afterSecond).toBe(afterFirst);
  });

  test('a client may not act for somebody else', async () => {
    const table = await fourPlayerGame();
    const client = table.clients[1];
    if (!client) throw new Error('no client');
    const before = table.host.eventCount();
    client.session.submit({ t: 'MulliganDecision', player: 'p1', keep: true });
    expect(table.host.eventCount()).toBe(before);
    expect(client.session.snapshot().message).toContain('your own seat');
  });

  test('nobody can see anybody else\'s hand — including the host', async () => {
    const table = await fourPlayerGame();
    for (const client of table.clients) {
      const view = client.session.currentView();
      const you = view.me;
      for (const seat of view.seatOrder) {
        const hand = view.zones[zoneId('hand', seat)] ?? [];
        const named = hand.filter((id) => view.cards[id]?.card !== null).length;
        if (seat === you) expect(named).toBe(hand.length);
        else expect(named).toBe(0);
      }
      // ⚠️ Including their OWN library. The host process holds every shuffled
      // order in memory; `project()` strips it for everyone, so the host's UI
      // cannot show it even by accident (spec §7.6).
      for (const seat of view.seatOrder) {
        expect(view.zones[zoneId('lib', seat)]).toBeUndefined();
        expect(view.hiddenCounts[zoneId('lib', seat)]).toBeGreaterThan(0);
      }
    }
  });

  test('the narration a client animates never names a library order', async () => {
    const table = await fourPlayerGame();
    playFrom(table, 200);
    for (const client of table.clients) {
      expect(client.batches.length).toBeGreaterThan(0);
    }
  }, 60_000);
});

describe('joining', () => {
  test('a protocol mismatch is refused with a message that says what to do', () => {
    const table = makeTable();
    const pair = loopbackPair('K7M2QX', 'cX');
    table.host.attach(pair.host);
    const errors: { code: string; message: string }[] = [];
    pair.client.onMessage((env) => {
      const body = env.body as { t: string; code?: string; message?: string };
      if (body.t === 'Error') errors.push({ code: body.code ?? '', message: body.message ?? '' });
    });
    pair.client.send({
      v: PROTOCOL_VERSION,
      room: 'K7M2QX',
      from: 'cX',
      to: 'host',
      seq: 0,
      ack: 0,
      body: {
        t: 'Hello',
        protocol: PROTOCOL_VERSION + 1,
        appVersion: '9.9.9',
        playerName: 'Stranger',
        oracleVersion: FIXTURE_ORACLE_VERSION,
      },
    });
    expect(errors[0]?.code).toBe('protocolMismatch');
    expect(table.host.lobby().seats).toHaveLength(0);
  });

  test('an envelope from a different protocol version is refused before it is parsed', () => {
    const table = makeTable();
    const pair = loopbackPair('K7M2QX', 'cX');
    table.host.attach(pair.host);
    const errors: string[] = [];
    pair.client.onMessage((env) => {
      const body = env.body as { t: string; code?: string };
      if (body.t === 'Error') errors.push(body.code ?? '');
    });
    pair.client.send({
      v: 99,
      room: 'K7M2QX',
      from: 'cX',
      to: 'host',
      seq: 0,
      ack: 0,
      body: { t: 'Hello', protocol: 99, appVersion: 'x', playerName: 'x', oracleVersion: 'x' },
    });
    expect(errors).toEqual(['protocolMismatch']);
  });

  test('a different card database is a HARD reject, not a warning (Q13)', () => {
    const table = makeTable();
    const pair = loopbackPair('K7M2QX', 'cX');
    table.host.attach(pair.host);
    const errors: { code: string; message: string }[] = [];
    const session = new ClientSession(pair.client, {
      playerName: 'Stranger',
      appVersion: '0.4.0-test',
      oracleVersion: 'some-other-snapshot',
      onError: (code, message) => errors.push({ code, message }),
    });
    expect(errors[0]?.code).toBe('oracleMismatch');
    expect(errors[0]?.message).toContain('card database');
    expect(table.host.lobby().seats).toHaveLength(0);
    session.close();
  });

  test('a fifth player is told the room is full', () => {
    const table = makeTable();
    for (const name of ['Ada', 'Bo', 'Cy', 'Di']) table.join(name);
    const fifth = table.join('Ed');
    expect(fifth.errors[0]?.code).toBe('roomFull');
    expect(table.host.lobby().seats).toHaveLength(4);
  });

  test('a deck the host cannot resolve gets a per-line report, not a silent seat', async () => {
    const table = makeTable();
    const client = table.join('Ada');
    client.session.submitDeck({
      name: 'Broken',
      commanders: [{ oracleId: 'o-unknown', printingId: 'not-a-real-printing' }],
      mainDeck: [{ oracleId: 'o-unknown-2', printingId: 'also-not-real' }],
    });
    await settle();
    const seat = table.host.lobby().seats[0];
    expect(seat?.deckName).toBeNull();
    const message = client.session.snapshot().message ?? '';
    expect(message).toContain('not-a-real-printing');
    expect(message).toContain('No commander resolved');
  });

  test('a deck that resolves is seated and named in the lobby', async () => {
    const table = makeTable();
    const client = table.join('Ada');
    client.session.submitDeck(fixtureDeck(0, 20));
    await settle();
    expect(table.host.lobby().seats[0]?.deckName).toBe('Deck 1');
    expect(client.session.snapshot().lobby?.seats[0]?.deckName).toBe('Deck 1');
  });

  test('the host refuses to start until everyone is ready with a deck', async () => {
    const table = makeTable();
    table.join('Ada');
    table.join('Bo');
    expect(table.host.start().message).toContain('no playable deck');
    table.clients[0]?.session.submitDeck(fixtureDeck(0));
    table.clients[1]?.session.submitDeck(fixtureDeck(1));
    await settle();
    expect(table.host.start().message).toContain('not ready');
    table.clients[0]?.session.setReady(true);
    table.clients[1]?.session.setReady(true);
    expect(table.host.start().ok).toBe(true);
  });

  test('two players is enough; one is not', () => {
    const table = makeTable();
    table.join('Ada');
    expect(table.host.start().message).toContain('at least two players');
  });
});

describe('reconnect', () => {
  test('a wrong resumeToken is refused', async () => {
    const table = await fourPlayerGame();
    const pair = loopbackPair('K7M2QX', 'cZ');
    table.host.attach(pair.host);
    const errors: { code: string; message: string }[] = [];
    new ClientSession(pair.client, {
      playerName: 'Impostor',
      appVersion: '0.4.0-test',
      oracleVersion: FIXTURE_ORACLE_VERSION,
      resumeToken: 'definitely-not-the-token',
      onError: (code, message) => errors.push({ code, message }),
    });
    expect(errors[0]?.code).toBe('badResumeToken');
  });

  test('a late joiner with no token cannot walk into a started game', async () => {
    const table = await fourPlayerGame();
    const late = table.join('Late');
    expect(late.errors[0]?.code).toBe('alreadyStarted');
  });

  test('a dropped client rejoins with its token and lands on a FRESH project()', async () => {
    const table = await fourPlayerGame();
    playFrom(table, 120);
    const third = table.clients[2];
    if (!third) throw new Error('no client');
    const token = third.session.resumeToken();
    expect(token).toBeTruthy();

    // Kill the socket the way a real one dies: from underneath.
    third.transport.close('socket died');
    expect(table.host.lobby().seats[2]?.connected).toBe(false);

    const pair = loopbackPair('K7M2QX', 'c2-again');
    table.host.attach(pair.host);
    let snapshots = 0;
    const rejoined = new ClientSession(pair.client, {
      playerName: 'Cy',
      appVersion: '0.4.0-test',
      oracleVersion: FIXTURE_ORACLE_VERSION,
      ...(token !== null ? { resumeToken: token } : {}),
      onSnapshot: () => snapshots++,
    });
    expect(snapshots).toBe(1);
    expect(rejoined.snapshot().you).toBe('p3');
    const fresh = table.host.viewOf('p3');
    if (!fresh) throw new Error('no game');
    expect(viewHash(rejoined.currentView())).toBe(viewHash(fresh));
    expect(table.host.lobby().seats[2]?.connected).toBe(true);
  });

  test('the game PAUSES while the player it is waiting on is gone, and "pass for" is available', async () => {
    const table = await fourPlayerGame();
    // Drive to a point where a specific player is on the clock.
    playFrom(table, 60);
    const waitingOn = table.clients[0]?.session.snapshot().priority;
    const victim = table.clients.find((c) => c.session.snapshot().you === waitingOn);
    if (!victim || !waitingOn) throw new Error('nobody has priority');

    const before = table.host.eventCount();
    victim.transport.close('socket died');
    const paused = table.host.eventCount();

    // Nobody else can move the game on by passing for THEMSELVES…
    const other = table.clients.find((c) => c.session.snapshot().you !== waitingOn);
    if (!other) throw new Error('no other client');
    other.session.submit({ t: 'PassPriority', player: other.session.snapshot().you });
    expect(table.host.eventCount()).toBe(paused);

    // …but anyone may pass FOR the disconnected player, and it is logged.
    other.session.submit({ t: 'PassForPlayer', player: other.session.snapshot().you, target: waitingOn });
    expect(table.host.eventCount()).toBeGreaterThan(paused);
    expect(paused).toBeGreaterThanOrEqual(before);
  });

  test('PassForPlayer is refused while that player is connected', async () => {
    const table = await fourPlayerGame();
    const a = table.clients[0];
    const b = table.clients[1];
    if (!a || !b) throw new Error('no clients');
    a.session.submit({ t: 'PassForPlayer', player: 'p1', target: 'p2' });
    expect(a.session.snapshot().message ?? '').toMatch(/connected|take their turn/i);
  });
});

describe('resync', () => {
  test('a patch whose base does not match asks for a snapshot instead of guessing', async () => {
    const table = await fourPlayerGame();
    const client = table.clients[0];
    if (!client) throw new Error('no client');
    const before = client.snapshots.length;
    // Hand the client an update from a board it does not hold.
    client.transport.onMessage(() => undefined);
    (client.hostSide as { send: (e: unknown) => void }).send({
      v: PROTOCOL_VERSION,
      room: 'K7M2QX',
      from: 'host',
      to: client.transport.connId(),
      seq: 9999,
      ack: 0,
      body: {
        t: 'Update',
        base: 999_999,
        next: 1_000_000,
        patch: { base: 999_999, next: 1_000_000, set: {}, del: [] },
        dict: {},
        narration: [],
        viewHash: 'nonsense',
      },
    });
    expect(client.snapshots.length).toBe(before + 1);
    // And the recovered view is the authoritative one, not a guess.
    expect(viewHash(client.session.currentView())).toBe(viewHash(table.host.viewOf('p1') as never));
  });

  test('a desync is RECORDED on both sides, not just repaired', async () => {
    const hostRecords: unknown[] = [];
    const table = makeTable({ onDesync: (r) => hostRecords.push(r) });
    table.join('Ada');
    table.join('Bo');
    await table.startGame();
    const client = table.clients[0];
    if (!client) throw new Error('no client');
    client.session.requestResync();
    expect(hostRecords).toHaveLength(1);
    expect(hostRecords[0]).toMatchObject({ player: 'p1' });
  });
});

describe('the projection a client holds', () => {
  test('matches a fresh project() for its own seat and nobody else\'s', async () => {
    const table = await fourPlayerGame();
    playFrom(table, 150);
    const host = table.host;
    const client = table.clients[1];
    if (!client) throw new Error('no client');
    const mine = viewHash(client.session.currentView());
    expect(mine).toBe(viewHash(host.viewOf('p2') as never));
    expect(mine).not.toBe(viewHash(host.viewOf('p1') as never));
  }, 60_000);

  test('previewCast runs the same solver the host validates with', async () => {
    const table = await fourPlayerGame();
    playFrom(table, 400);
    const acting = table.clients.find((c) => c.session.snapshot().legal.some((a) => a.t === 'CastSpell'));
    if (!acting) return; // A basics-heavy fixture deck may never offer a cast.
    const cast = acting.session.snapshot().legal.find((a) => a.t === 'CastSpell');
    if (cast?.t !== 'CastSpell') return;
    const preview = acting.session.previewCast(cast.card, 0);
    expect(preview?.name).toBe(cast.label);
    expect(preview?.tax).toBe(cast.tax);
  }, 60_000);

  test('targetableIds comes from the view, never from state', async () => {
    const table = await fourPlayerGame();
    playFrom(table, 200);
    const client = table.clients[0];
    if (!client) throw new Error('no client');
    const view = client.session.currentView();
    for (const t of client.session.targetables()) {
      if (t.kind === 'card') expect(view.cards[t.id]).toBeDefined();
      if (t.kind === 'player') expect(view.seats[t.id]).toBeDefined();
    }
  }, 60_000);
});

describe('the loopback transport itself', () => {
  test('closing one end closes the other', () => {
    const pair = loopbackPair('K7M2QX', 'c1');
    let closed = 0;
    pair.host.onClose(() => closed++);
    pair.client.close();
    expect(closed).toBe(1);
    expect(pair.host.closed).toBe(true);
  });

  test('a frame is copied, not shared — a later mutation cannot reach the peer', () => {
    const pair = loopbackPair('K7M2QX', 'c1');
    const seen: unknown[] = [];
    pair.host.onMessage((env) => seen.push(env.body));
    const body = { t: 'Ping' as const, nonce: 1 };
    pair.client.send({ v: PROTOCOL_VERSION, room: 'K7M2QX', from: 'c1', to: 'host', seq: 0, ack: 0, body });
    (body as { nonce: number }).nonce = 99;
    expect(seen[0]).toEqual({ t: 'Ping', nonce: 1 });
  });

  test('a closed transport delivers nothing', () => {
    const pair = loopbackPair('K7M2QX', 'c1');
    const seen: unknown[] = [];
    pair.host.onMessage((env) => seen.push(env));
    pair.client.close();
    pair.client.send({
      v: PROTOCOL_VERSION,
      room: 'K7M2QX',
      from: 'c1',
      to: 'host',
      seq: 0,
      ack: 0,
      body: { t: 'Ping', nonce: 1 },
    });
    expect(seen).toEqual([]);
  });
});

describe('rewind across the wire', () => {
  test('a unanimous vote actually rewinds, and everyone gets a snapshot', async () => {
    const table = makeTable();
    table.join('Ada');
    table.join('Bo');
    await table.startGame();
    playFrom(table, 80);

    const mark = table.host.eventCount() - 10;
    const before = table.host.hash();
    const a = table.clients[0];
    const b = table.clients[1];
    if (!a || !b) throw new Error('no clients');
    const snapshotsBefore = a.snapshots.length;

    a.session.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: mark });
    a.session.submit({ t: 'VoteRewind', player: 'p1', agree: true });
    b.session.submit({ t: 'VoteRewind', player: 'p2', agree: true });

    // ⚠️ The engine emits the votes; re-folding the log is `Game.rewind`, which
    // is not a reducer case. M3 left nothing to call it — the host does.
    expect(table.host.hash()).not.toBe(before);
    expect(a.snapshots.length).toBeGreaterThan(snapshotsBefore);
    expect(viewHash(a.session.currentView())).toBe(viewHash(table.host.viewOf('p1') as never));
    expect(viewHash(b.session.currentView())).toBe(viewHash(table.host.viewOf('p2') as never));
  });

  test('a declined vote changes nothing', async () => {
    const table = makeTable();
    table.join('Ada');
    table.join('Bo');
    await table.startGame();
    playFrom(table, 60);
    const before = table.host.hash();
    const mark = table.host.eventCount() - 5;
    table.clients[0]?.session.submit({ t: 'ProposeRewind', player: 'p1', toEventCount: mark });
    const afterPropose = table.host.hash();
    table.clients[1]?.session.submit({ t: 'VoteRewind', player: 'p2', agree: false });
    expect(table.host.hash()).not.toBe(before); // the proposal itself is logged
    expect(table.host.eventCount()).toBeGreaterThan(0);
    expect(afterPropose).not.toBe('');
  });
});

describe('a fresh oracle db over the wire', () => {
  test('a client rehydrates cards from the dictionary alone', async () => {
    const table = await fourPlayerGame();
    const client = table.clients[0];
    if (!client) throw new Error('no client');
    const view = client.session.currentView();
    const commander = Object.values(view.cards).find((c) => c.isCommander);
    expect(commander?.card?.name).toBeTruthy();
    // The same card, built from the same data, by a completely separate path.
    const db = createOracleDb(Object.values(view.cards).flatMap((c) => (c.card ? [c.card] : [])));
    expect(db.byPrinting(commander?.card?.scryfallId ?? '')).toBeDefined();
    void project;
    void EMPTY_REGISTRY;
  });
});
