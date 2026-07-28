// The LAN listener: a one-room relay that runs inside this app while — and only
// while — the user is hosting a game on their own network.
//
// ⚠️ THE ONE PLACE THIS APP BINDS ANYTHING BUT LOOPBACK, and it is a documented
// deviation from the workspace rule that dev servers bind localhost only. The
// bind happens when the user starts a LAN game, is token-gated, and CLOSES WITH
// THE GAME — `stop()` is called from the same place the session ends, and from
// `before-quit`, so a crashed renderer cannot leave a socket open on the
// network. The Vite dev server still binds localhost only.
//
// ⚠️ IT SPEAKS THE SAME PROTOCOL AS `relay/src/server.js`, and it deliberately
// does not share code with it. The relay is deployed on its own to a VPS with
// `npm i && node src/server.js`, and M5's bundle audit requires that `relay/`
// never reach `app.asar` — so importing it here would either break the audit or
// force the relay to grow a build step. This file is the one-room case: no
// registry, no TTL, and a join token, which is about a third of the logic and
// none of the same lifetime.

const crypto = require('node:crypto');
const http = require('node:http');
const os = require('node:os');
const { WebSocketServer } = require('ws');

const PROTOCOL_VERSION = 1;
const DEFAULT_PORT = 5282;
const MAX_MEMBERS = 4;
const MAX_MESSAGE_BYTES = 1024 * 1024;
const MAX_MESSAGES_PER_SECOND = 400;

/**
 * ⚠️ SIX CHARACTERS FROM THE SAME UNAMBIGUOUS ALPHABET AS THE RELAY. The first
 * version used the literal string `LANGAME`, which is seven characters and
 * contains an `A` where the relay's codes never would — and the join form's
 * "a room code is six characters" check refused it. A LAN code is read aloud
 * exactly like a relay code, so it has to BE one.
 */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

function newRoomCode() {
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH * 2);
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return out;
}

function isRoomCodeShape(code) {
  if (typeof code !== 'string' || code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_ALPHABET.includes(ch)) return false;
  return true;
}

let state = null;

/** Every LAN address a guest could type. Excludes loopback and virtual bridges. */
function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      out.push({ name, address: addr.address });
    }
  }
  return out;
}

function send(socket, body, room) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(
    JSON.stringify({ v: PROTOCOL_VERSION, room: room || '', from: 'relay', to: 'you', seq: 0, ack: 0, body }),
  );
}

function isRoutable(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.v === 'number' &&
    typeof value.room === 'string' &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    typeof value.body === 'object' &&
    value.body !== null
  );
}

/**
 * Start hosting on the local network.
 *
 * Returns `{ ok, code, token, port, addresses }`. The token is what a guest
 * must present in `RelayJoin`; without it a stranger on a shared network (a
 * flat, a coffee shop, a university hall) could walk into the room.
 */
function start({ code, port } = {}) {
  if (state) return { ok: true, ...describe() };
  const room = isRoomCodeShape(code) ? code : newRoomCode();
  const token = crypto.randomBytes(16).toString('hex');
  const wanted = Number.isInteger(port) ? port : DEFAULT_PORT;

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

  const members = new Map();
  let host = null;
  let nextId = 0;

  wss.on('connection', (socket) => {
    const conn = { id: `l${nextId++}`, socket, joined: false, windowStart: Date.now(), windowCount: 0 };

    socket.on('message', (data, isBinary) => {
      if (isBinary || data.length > MAX_MESSAGE_BYTES) return;
      const now = Date.now();
      if (now - conn.windowStart >= 1000) {
        conn.windowStart = now;
        conn.windowCount = 0;
      }
      if (++conn.windowCount > MAX_MESSAGES_PER_SECOND) {
        send(socket, { t: 'RelayError', code: 'rateLimited', message: 'Too many messages.' }, room);
        return;
      }

      let envelope;
      try {
        envelope = JSON.parse(data.toString('utf8'));
      } catch {
        return;
      }
      if (!isRoutable(envelope)) return;
      if (envelope.v !== PROTOCOL_VERSION) {
        send(
          socket,
          { t: 'RelayError', code: 'protocolMismatch', message: `This game speaks protocol ${PROTOCOL_VERSION}.` },
          room,
        );
        return;
      }

      const body = envelope.body;

      // The host claims its slot with the token; a guest joins with it too.
      if (body.t === 'RelayCreateRoom' || body.t === 'RelayJoin') {
        if (conn.joined) return;
        // ⚠️ Token-gated. A room code alone is six characters read aloud in a
        // room full of people; the token is 128 bits that only the host's own
        // screen shows.
        if (body.token !== token) {
          send(socket, { t: 'RelayError', code: 'noSuchRoom', message: 'Wrong game code for this host.' }, room);
          return;
        }
        if (members.size >= MAX_MEMBERS) {
          send(socket, { t: 'RelayError', code: 'roomFull', message: 'That game is full.' }, room);
          return;
        }
        conn.joined = true;
        members.set(conn.id, conn);
        const asHost = body.t === 'RelayCreateRoom' || body.asHost === true;
        if (asHost && host === null) host = conn;
        if (body.t === 'RelayCreateRoom') {
          send(socket, { t: 'RelayRoomCreated', code: room, connId: conn.id }, room);
        } else {
          send(socket, { t: 'RelayJoined', code: room, connId: conn.id, hostPresent: host !== null }, room);
        }
        for (const member of members.values()) {
          if (member !== conn) send(member.socket, { t: 'RelayPeerJoined', connId: conn.id }, room);
        }
        return;
      }

      if (!conn.joined) return;
      const frame = JSON.stringify(envelope);
      if (envelope.to === 'host') {
        if (host && host !== conn) host.socket.send(frame);
        return;
      }
      if (envelope.to === 'all') {
        for (const member of members.values()) if (member !== conn) member.socket.send(frame);
        return;
      }
      const target = members.get(envelope.to);
      if (target && target !== conn) target.socket.send(frame);
    });

    const drop = () => {
      if (!members.delete(conn.id)) return;
      if (host === conn) host = null;
      for (const member of members.values()) {
        send(member.socket, { t: 'RelayPeerLeft', connId: conn.id }, room);
      }
    };
    socket.on('close', drop);
    socket.on('error', drop);
  });

  // ⚠️ 0.0.0.0 — the whole point. See the header for why that is allowed here
  // and nowhere else in this app.
  return new Promise((resolve) => {
    let settled = false;
    // ⚠️ `on`, NOT `once`, and it must survive being resolved. A listening
    // socket can emit `error` at any time — and an unhandled `error` on a
    // net.Server is an UNCAUGHT EXCEPTION, which in Electron means a modal
    // "A JavaScript error occurred in the main process" dialog and a dead app.
    // Observed exactly that way: a previous run's window was killed without
    // running `before-quit`, its listener kept port 5282, and the next run
    // crashed on EADDRINUSE instead of saying the port was busy.
    server.on('error', (err) => {
      const message =
        err && err.code === 'EADDRINUSE'
          ? `Another copy of the app is already hosting on this machine (port ${wanted}). Close it, then host again.`
          : `Could not start the LAN game: ${String(err && err.message ? err.message : err)}`;
      if (settled) {
        // Already running (or already reported). Tear the listener down rather
        // than leaving a half-dead socket bound.
        void stop();
        return;
      }
      settled = true;
      state = null;
      try {
        server.close();
      } catch {
        // Nothing was listening.
      }
      resolve({ ok: false, running: false, code: '', token: '', port: 0, addresses: [], message });
    });
    server.listen(wanted, '0.0.0.0', () => {
      if (settled) return;
      settled = true;
      state = { server, wss, room, token, port: server.address().port, startedAt: Date.now() };
      resolve({ ok: true, ...describe() });
    });
  });
}

function describe() {
  if (!state) return { running: false, code: '', token: '', port: 0, addresses: [] };
  return {
    running: true,
    code: state.room,
    token: state.token,
    port: state.port,
    addresses: lanAddresses().map((a) => ({ ...a, url: `ws://${a.address}:${state.port}` })),
  };
}

function status() {
  return describe();
}

/**
 * Stop listening.
 *
 * ⚠️ Called from the session teardown AND from `before-quit`. A LAN listener
 * that outlives the game it was started for is a socket on somebody's home
 * network that nobody knows is open.
 */
async function stop() {
  const current = state;
  state = null;
  if (!current) return { running: false };
  for (const client of current.wss.clients) client.terminate();
  await new Promise((resolve) => current.wss.close(() => current.server.close(() => resolve())));
  return { running: false };
}

module.exports = { start, stop, status, lanAddresses, newRoomCode, isRoomCodeShape, DEFAULT_PORT, PROTOCOL_VERSION };
