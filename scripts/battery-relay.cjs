/**
 * Relay battery: the room registry, blind forwarding, and the restart path.
 *
 *   node scripts/battery-relay.cjs
 *
 * ⚠️ THE ONE TRANSPORT NOTHING ELSE COVERS. `two-instance.cjs` puts two real
 * apps on one LAN socket, and `src/net/net.test.ts` runs a host plus four
 * clients over `loopbackPair` — neither goes near `relay/`. Playing with friends
 * over the internet is the relay, and until this existed it was checked only by
 * `relay.node.test.ts`, which greps that the relay does not import `src/`.
 *
 * ⚠️ It boots the relay IN-PROCESS on an ephemeral port through `startRelay()`,
 * which is exactly why that function returns its server: killing and restarting
 * a relay mid-game is a thing that has to work, and a test cannot check it
 * against a relay it does not control.
 *
 * ⚠️ NOTHING HERE IMPORTS `src/`, and that is the point rather than an
 * accident. A relay that could see the engine would be a second source of
 * truth, so a battery that needed the engine to talk to the relay would be
 * proving the wrong thing. The frames below are hand-built envelopes.
 *
 * Needs the relay's own dependency: `npm i` in `relay/` (just `ws`).
 */

const path = require('path');

const RELAY_DIR = path.join(__dirname, '..', 'relay');
let startRelay;
let WebSocket;
try {
  ({ startRelay } = require(path.join(RELAY_DIR, 'src', 'server.js')));
  WebSocket = require(path.join(RELAY_DIR, 'node_modules', 'ws'));
} catch (e) {
  console.error('\nThe relay is not installed. Run:  cd relay && npm i\n');
  console.error(e.message);
  process.exit(1);
}

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) {
    pass += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One relay client, as raw as the wire.
 *
 * ⚠️ `to` is meaningful and this battery leans on it: `'host'`, `'all'`, or a
 * connection id that is IN THE SAME ROOM. Anything else routes nowhere, which
 * is the isolation check below.
 */
function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
  ws.on('error', () => { /* close races at teardown are not failures */ });
  return {
    ws,
    inbox,
    open: () => new Promise((res) => ws.on('open', res)),
    send: (body, room = '', to = '') =>
      ws.send(JSON.stringify({ v: 1, room, from: '', to, seq: 0, ack: 0, body })),
    /** The first frame whose body has this `t`, or null within the deadline. */
    waitFor: async (t, ms = 3000) => {
      const until = Date.now() + ms;
      for (;;) {
        const hit = inbox.find((m) => m.body && m.body.t === t);
        if (hit) return hit;
        if (Date.now() >= until) return null;
        await sleep(25);
      }
    },
    saw: (t) => inbox.some((m) => m.body && m.body.t === t),
  };
}

async function main() {
  console.log('\n── Rooms and blind forwarding ──');
  let relay = startRelay();
  const port = await relay.listen(0);
  ok('the relay listens on an ephemeral port', typeof port === 'number' && port > 0, `:${port}`);

  const host = client(port);
  await host.open();
  host.send({ t: 'RelayCreateRoom' });
  const created = await host.waitFor('RelayRoomCreated');
  ok('a host can create a room', !!created, created ? `code ${created.body.code}` : 'no reply');
  const code = created && created.body.code;

  const guest = client(port);
  await guest.open();
  guest.send({ t: 'RelayJoin', code }, code);
  const joined = await guest.waitFor('RelayJoined');
  ok('a guest joins with the code', !!joined && joined.body.code === code,
    joined ? `hostPresent=${joined.body.hostPresent}` : 'no reply');

  // ⚠️ Presence is announced BY THE RELAY, not inferred by the host from a
  // `Hello` that may never arrive — a client that connects then crashes must
  // not leave the host waiting for a player who is gone.
  const arrived = await host.waitFor('RelayPeerJoined');
  ok('the host is told a peer arrived, by the relay', !!arrived,
    arrived ? `connId ${arrived.body.connId}` : 'no RelayPeerJoined');

  // ⚠️ THE WHOLE POINT OF A BLIND ROUTER. The relay reads `v`, `room` and `to`
  // and nothing else, so a body it has never heard of has to arrive intact. If
  // this needed the relay to understand the game, the relay would be a second
  // source of truth — and the wire could not later be encrypted end-to-end.
  const opaque = {
    t: 'SomethingTheRelayHasNeverHeardOf',
    nested: { deep: [1, 2, { three: 'x' }] },
    unicode: 'Kess, Dissident Mage — {2}{U}{B}{R}',
  };
  host.send(opaque, code, 'all');
  const broadcast = await guest.waitFor('SomethingTheRelayHasNeverHeardOf');
  ok('an unknown body broadcasts to the other member', !!broadcast);
  ok('…byte-for-byte, nested structure and unicode intact',
    !!broadcast && JSON.stringify(broadcast.body) === JSON.stringify(opaque),
    broadcast ? 'identical' : 'not received');

  host.send({ t: 'AddressedDirectly', n: 7 }, code, joined ? joined.body.connId : '');
  ok('a frame addressed to one connId reaches that member',
    !!(await guest.waitFor('AddressedDirectly')));

  // ⚠️ THE ISOLATION BAR. `route()` looks the target up in the SENDER'S room, so
  // a connection cannot address an id belonging to another game. That check is
  // the one thing standing between a blind router and a frame leaking between
  // two unrelated tables.
  const outsider = client(port);
  await outsider.open();
  outsider.send({ t: 'RelayCreateRoom' });
  const otherRoom = await outsider.waitFor('RelayRoomCreated');
  ok('a second, unrelated room exists', !!otherRoom && otherRoom.body.code !== code,
    otherRoom ? `code ${otherRoom.body.code}` : 'not created');
  host.send({ t: 'ShouldNeverArrive' }, code, otherRoom ? otherRoom.body.connId : 'c99');
  await sleep(400);
  ok('a frame addressed into ANOTHER room reaches nobody', !outsider.saw('ShouldNeverArrive'));
  outsider.ws.close();

  const stranger = client(port);
  await stranger.open();
  stranger.send({ t: 'RelayJoin', code: 'ZZZZZZ' }, 'ZZZZZZ');
  const noSuch = await stranger.waitFor('RelayError');
  ok('an unknown room code is refused, and the message says what to do',
    !!noSuch && noSuch.body.code === 'noSuchRoom',
    noSuch ? JSON.stringify(noSuch.body.message) : 'no error reply');

  // ⚠️ A MEMBER leaving is announced; the refused stranger above is not a
  // member, so its socket closing must announce nothing. Testing the wrong one
  // of those two passes for the wrong reason.
  stranger.ws.close();
  guest.ws.close();
  const left = await host.waitFor('RelayPeerLeft');
  ok('…and the host is told when a MEMBER leaves', !!left,
    left ? `connId ${left.body.connId}` : 'no RelayPeerLeft');

  console.log('\n── Restarting the relay under a live game ──');
  host.ws.close();
  await sleep(150);
  await relay.close();
  await sleep(250);

  relay = startRelay();
  const port2 = await relay.listen(port);
  ok('the relay comes back on the same port', port2 === port, `:${port2}`);

  // ⚠️ THIS is why `RelayCreateRoom` takes a code at all. A relay restart drops
  // every room, and the players are all still looking at a code on screen — so
  // the host re-creates THAT code rather than being handed a new one nobody was
  // told about.
  const host2 = client(port);
  await host2.open();
  host2.send({ t: 'RelayCreateRoom', code });
  const recreated = await host2.waitFor('RelayRoomCreated');
  ok('the host re-creates the room with its ORIGINAL code',
    !!recreated && recreated.body.code === code,
    recreated ? `code ${recreated.body.code}` : 'refused');

  const guest2 = client(port);
  await guest2.open();
  guest2.send({ t: 'RelayJoin', code }, code);
  const rejoined = await guest2.waitFor('RelayJoined');
  ok('a guest rejoins with the code it already had',
    !!rejoined && rejoined.body.code === code);

  // ⚠️ Refused, never silently substituted. Handing back a different code
  // leaves the host holding one nobody else was told about, and every guest
  // then fails with `noSuchRoom` forever — a broken-relay-looking typo.
  const impostor = client(port);
  await impostor.open();
  impostor.send({ t: 'RelayCreateRoom', code });
  const taken = await impostor.waitFor('RelayError');
  ok('a code already in use is refused, not silently replaced',
    !!taken && taken.body.code === 'roomTaken',
    taken ? taken.body.code : 'no error');

  host2.ws.close();
  guest2.ws.close();
  impostor.ws.close();
  await sleep(150);
  await relay.close();

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${pass}/${pass + fail} checks passed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  • ${f}`);
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('\nBattery crashed:', e);
  process.exit(1);
});
