'use strict';

// The relay. A room registry and a router — nothing else.
//
// ⚠️ ZERO GAME LOGIC, AND THAT IS A DESIGN DECISION RATHER THAN A SHORTCUT.
// The host is authoritative by decision; a relay that understood the game would
// be a second source of truth, which is the exact thing that produces "the
// server and the host disagree" bugs with no principled resolution. It follows
// that this file may never import anything from `../../src/engine` — a test in
// the app greps for exactly that.
//
// ⚠️ IT ALSO NEVER NEEDS TO. Redaction happens host-side, BEFORE transmission,
// so every frame that arrives here is already addressed to one recipient and
// already stripped of what that recipient may not see. The relay therefore does
// not need to know what a hand is in order to avoid leaking one.
//
// ⚠️ IT READS ONLY `v`, `room` AND `to`. Everything else in an envelope is
// opaque bytes. That is what makes it restartable mid-game (clients reconnect
// and resync), impossible to desync, and independent of the card database, the
// oracle version and the rules — a rules change never requires redeploying it.
//
// Confidentiality caveat, stated rather than hidden: the operator of a relay can
// read all traffic passing through it. Under a friends-only trust model with a
// self-hosted relay that is fine. If it ever stops being fine, the near-free
// hardening is AES-GCM over `body` with a key derived from the room code plus a
// passphrase shown in the host's UI — and the relay keeps working unchanged,
// because it only ever reads `v`, `room` and `to`.

const http = require('node:http');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');

const PROTOCOL_VERSION = 1;

/** No I, O, 0 or 1 — the four characters people mis-hear over voice chat. */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

const ROOM_TTL_MS = 4 * 60 * 60 * 1000;
/** How long a room survives its host going away, so a reconnect can find it. */
const HOST_GRACE_MS = 5 * 60 * 1000;
const SWEEP_MS = 30 * 1000;

const MAX_MEMBERS = 4;
const MAX_MESSAGE_BYTES = 1024 * 1024;
const MAX_MESSAGES_PER_SECOND = 200;

function isRoomCodeShape(code) {
  if (typeof code !== 'string' || code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_ALPHABET.includes(ch)) return false;
  return true;
}

function newRoomCode() {
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH * 2);
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return out;
}

/**
 * Is this a frame we can route?
 *
 * ⚠️ Decided from `v`, `room`, `from` and `to` ALONE. If this needed `body` the
 * relay would have to understand the game, which is the one thing it must not.
 */
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

class Relay {
  constructor(options = {}) {
    this.rooms = new Map();
    this.now = options.now || (() => Date.now());
    this.log = options.log || (() => {});
    this.nextConn = 0;
    this.sweeper = null;
  }

  // ── rooms ────────────────────────────────────────────────────────────────

  createRoom(conn, wanted) {
    // ⚠️ An explicit code is REFUSED rather than silently replaced. Substituting
    // a random one leaves the host holding a code nobody else was told about,
    // and every guest then fails with `noSuchRoom` forever — a failure that
    // looks like a broken relay and is actually a typo. Cost one debugging round
    // when a test asked for a code containing an `I`.
    let code;
    if (wanted !== undefined && wanted !== null && wanted !== '') {
      if (!isRoomCodeShape(wanted)) {
        send(conn, { t: 'RelayError', code: 'badRequest', message: 'That room code is not a valid code.' }, '');
        return null;
      }
      if (this.rooms.has(wanted)) {
        send(conn, { t: 'RelayError', code: 'roomTaken', message: 'That room already exists.' }, wanted);
        return null;
      }
      code = wanted;
    } else {
      code = newRoomCode();
    }
    for (let guard = 0; this.rooms.has(code) && guard < 50; guard++) code = newRoomCode();
    const room = {
      code,
      host: conn,
      members: new Map([[conn.id, conn]]),
      createdAt: this.now(),
      hostLeftAt: null,
    };
    this.rooms.set(code, room);
    conn.room = room;
    this.log('room created', code);
    send(conn, { t: 'RelayRoomCreated', code, connId: conn.id }, code);
    return room;
  }

  join(conn, rawCode, asHost) {
    const code = String(rawCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      send(conn, { t: 'RelayError', code: 'noSuchRoom', message: 'No game with that code. Check it and try again.' }, code);
      return;
    }
    if (room.members.size >= MAX_MEMBERS) {
      send(conn, { t: 'RelayError', code: 'roomFull', message: 'That game is full.' }, code);
      return;
    }
    room.members.set(conn.id, conn);
    conn.room = room;
    // Reclaiming the host slot is allowed only while the room has no host —
    // i.e. inside the grace window after the host's own socket died.
    if (asHost === true && room.host === null) {
      room.host = conn;
      room.hostLeftAt = null;
      this.log('host reclaimed', code);
    }
    send(conn, { t: 'RelayJoined', code, connId: conn.id, hostPresent: room.host !== null }, code);
    // ⚠️ Presence is announced by the RELAY, not inferred by the host from a
    // `Hello` that may never arrive. A client that connects and then crashes
    // before saying hello would otherwise be invisible.
    for (const member of room.members.values()) {
      if (member !== conn) send(member, { t: 'RelayPeerJoined', connId: conn.id }, code);
    }
  }

  /**
   * Forward one frame.
   *
   * `'host'` → the room's host connection. `'all'` → every member but the
   * sender. Anything else → that connection id, if it is in the same room.
   */
  route(conn, envelope) {
    const room = conn.room;
    if (!room) {
      send(conn, { t: 'RelayError', code: 'noSuchRoom', message: 'Join a room first.' }, envelope.room);
      return;
    }
    const to = envelope.to;
    if (to === 'host') {
      if (room.host && room.host !== conn) room.host.socket.send(JSON.stringify(envelope));
      return;
    }
    if (to === 'all') {
      for (const member of room.members.values()) {
        if (member !== conn) member.socket.send(JSON.stringify(envelope));
      }
      return;
    }
    const target = room.members.get(to);
    // ⚠️ Same room only. Without this check a connection could address any id on
    // the whole relay, which is the one way a blind router could leak a frame
    // between two unrelated games.
    if (target && target !== conn) target.socket.send(JSON.stringify(envelope));
  }

  drop(conn) {
    const room = conn.room;
    if (!room) return;
    room.members.delete(conn.id);
    conn.room = null;
    for (const member of room.members.values()) {
      send(member, { t: 'RelayPeerLeft', connId: conn.id }, room.code);
    }
    if (room.host === conn) {
      room.host = null;
      // ⚠️ Not deleted immediately. The host's own socket dying is exactly when
      // its players most need the room to still be there, so the code they are
      // all looking at keeps working while it reconnects.
      room.hostLeftAt = this.now();
      this.log('host left', room.code);
    }
    if (room.members.size === 0 && room.host === null) {
      this.rooms.delete(room.code);
      this.log('room empty', room.code);
    }
  }

  sweep() {
    const now = this.now();
    for (const [code, room] of [...this.rooms]) {
      const expired = now - room.createdAt > ROOM_TTL_MS;
      const orphaned = room.hostLeftAt !== null && room.host === null && now - room.hostLeftAt > HOST_GRACE_MS;
      if (!expired && !orphaned) continue;
      for (const member of room.members.values()) {
        send(member, { t: 'RelayError', code: 'noSuchRoom', message: 'That game has expired.' }, code);
        member.socket.close(1000, 'room expired');
      }
      this.rooms.delete(code);
      this.log('room evicted', code, expired ? 'ttl' : 'host gone');
    }
  }

  // ── connections ──────────────────────────────────────────────────────────

  accept(socket) {
    const conn = {
      id: `c${this.nextConn++}`,
      socket,
      room: null,
      windowStart: this.now(),
      windowCount: 0,
    };

    socket.on('message', (data, isBinary) => {
      if (isBinary || data.length > MAX_MESSAGE_BYTES) {
        send(conn, { t: 'RelayError', code: 'badRequest', message: 'Frame refused.' }, '');
        return;
      }
      // ⚠️ A fixed window, not a token bucket. The threat is a runaway loop in a
      // friend's build, not an attacker — and a simple counter is auditable at a
      // glance, which matters more here than smoothness.
      const now = this.now();
      if (now - conn.windowStart >= 1000) {
        conn.windowStart = now;
        conn.windowCount = 0;
      }
      conn.windowCount += 1;
      if (conn.windowCount > MAX_MESSAGES_PER_SECOND) {
        send(conn, { t: 'RelayError', code: 'rateLimited', message: 'Too many messages.' }, '');
        return;
      }

      let envelope;
      try {
        envelope = JSON.parse(data.toString('utf8'));
      } catch {
        send(conn, { t: 'RelayError', code: 'badRequest', message: 'Not a frame.' }, '');
        return;
      }
      if (!isRoutable(envelope)) {
        send(conn, { t: 'RelayError', code: 'badRequest', message: 'Not a frame.' }, '');
        return;
      }
      if (envelope.v !== PROTOCOL_VERSION) {
        send(
          conn,
          {
            t: 'RelayError',
            code: 'protocolMismatch',
            message: `This relay speaks protocol ${PROTOCOL_VERSION}.`,
          },
          envelope.room,
        );
        return;
      }

      const body = envelope.body;
      if (body.t === 'RelayCreateRoom') {
        if (!conn.room) this.createRoom(conn, body.code);
        return;
      }
      if (body.t === 'RelayJoin') {
        if (!conn.room) this.join(conn, body.code, body.asHost);
        return;
      }
      this.route(conn, envelope);
    });

    socket.on('close', () => this.drop(conn));
    socket.on('error', () => this.drop(conn));
    return conn;
  }

  startSweeper() {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweep(), SWEEP_MS);
    if (typeof this.sweeper.unref === 'function') this.sweeper.unref();
  }

  stopSweeper() {
    if (!this.sweeper) return;
    clearInterval(this.sweeper);
    this.sweeper = null;
  }
}

function send(conn, body, room) {
  if (conn.socket.readyState !== conn.socket.OPEN) return;
  conn.socket.send(
    JSON.stringify({ v: PROTOCOL_VERSION, room: room || '', from: 'relay', to: conn.id, seq: 0, ack: 0, body }),
  );
}

/**
 * Start a relay.
 *
 * Returns `{ server, wss, relay, port, close() }`, so a test can boot one
 * in-process on an ephemeral port and shut it down — which is how "killing and
 * restarting the relay mid-game lets every client resync" gets tested at all.
 */
function startRelay(options = {}) {
  const relay = new Relay(options);
  const server = http.createServer((req, res) => {
    // A health endpoint and nothing else. The relay serves no content: it has
    // none, by design.
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, rooms: relay.rooms.size }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });
  wss.on('connection', (socket) => relay.accept(socket));
  relay.startSweeper();

  return {
    relay,
    server,
    wss,
    listen(port, host) {
      return new Promise((resolve) => {
        server.listen(port, host || '127.0.0.1', () => resolve(server.address().port));
      });
    },
    close() {
      relay.stopSweeper();
      for (const client of wss.clients) client.terminate();
      return new Promise((resolve) => {
        wss.close(() => server.close(() => resolve()));
      });
    },
  };
}

module.exports = {
  Relay,
  isRoomCodeShape,
  startRelay,
  isRoutable,
  newRoomCode,
  PROTOCOL_VERSION,
  ROOM_ALPHABET,
  MAX_MEMBERS,
  MAX_MESSAGE_BYTES,
  MAX_MESSAGES_PER_SECOND,
};

// Run directly: `node relay/src/server.js [port] [host]`
if (require.main === module) {
  const port = Number(process.argv[2] || process.env.PORT || 5281);
  const host = process.argv[3] || process.env.HOST || '0.0.0.0';
  const relay = startRelay({ log: (...args) => console.log('[relay]', ...args) });
  relay.listen(port, host).then((actual) => {
    console.log(`[relay] listening on ws://${host}:${actual} (protocol ${PROTOCOL_VERSION})`);
  });
}
