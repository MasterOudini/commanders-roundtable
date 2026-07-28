// The relay link: a `Transport` that owns the room handshake on top of a
// WebSocket.
//
// ⚠️ THE HANDSHAKE IS PART OF THE TRANSPORT, NOT OF THE SESSION. A frame sent
// before the relay has put this connection in a room is routed nowhere and
// silently dropped — which, from the session's point of view, is indistinguish-
// able from "the host never answered". So `ready` means "in a room", and only
// then does the session get to speak.
//
// ⚠️ A RELAY RESTART IS A SUPPORTED EVENT, not a failure. The relay holds no
// game state, so when it comes back the host re-creates the room WITH THE SAME
// CODE (`RelayCreateRoom{code}`, granted only if free), the clients re-join, and
// each client re-sends `Hello{resumeToken}` — which the host answers with a
// `Snapshot`. Nobody has to type anything, and the code on everyone's screen
// stays correct. That property is why `RelayCreateRoom` takes a code at all.

import { envelope, type ConnId, type Envelope, type RelayControl } from './protocol';
import { SocketTransport, type SocketStatus } from './socketTransport';
import type { Transport, Unsubscribe } from './transport';

export interface RelayLinkOptions {
  readonly url: string;
  /** Host: create (or re-create) this room. Guest: join it. */
  readonly code: string;
  readonly asHost: boolean;
  /** Required for a LAN listener, ignored by the internet relay. */
  readonly token?: string;
  readonly onStatus?: (status: SocketStatus) => void;
  readonly onRelayError?: (code: string, message: string) => void;
  readonly factory?: (url: string) => WebSocket;
  readonly maxBackoffMs?: number;
}

export class RelayLink implements Transport {
  private readonly socket: SocketTransport;
  private readonly readyFns: ((reconnected: boolean) => void)[] = [];
  private readonly messageFns: ((envelope: Envelope) => void)[] = [];
  private readonly closeFns: ((reason: string) => void)[] = [];
  private readonly pending: Envelope[] = [];
  private inRoom = false;
  private reclaimTried = false;
  private handshakes = 0;
  private roomCode: string;

  constructor(private readonly opts: RelayLinkOptions) {
    this.roomCode = opts.code;
    this.socket = new SocketTransport({
      url: opts.url,
      room: opts.code,
      ...(opts.onStatus !== undefined ? { onStatus: opts.onStatus } : {}),
      ...(opts.factory !== undefined ? { factory: opts.factory } : {}),
      ...(opts.maxBackoffMs !== undefined ? { maxBackoffMs: opts.maxBackoffMs } : {}),
      onOpen: () => {
        this.inRoom = false;
        this.reclaimTried = false;
        this.handshake();
      },
    });
    this.socket.onMessage((env) => this.receive(env));
    this.socket.onClose((reason) => {
      this.inRoom = false;
      for (const fn of [...this.closeFns]) fn(reason);
    });
  }

  get room(): string {
    return this.roomCode;
  }

  get closed(): boolean {
    return this.socket.closed;
  }

  connId(): ConnId {
    return this.socket.connId();
  }

  code(): string {
    return this.roomCode;
  }

  private handshake(): void {
    // ⚠️ A first-time host asks for NO code — the relay mints one, and that is
    // the only place a room code is ever born. On a reconnect `roomCode` is the
    // one the relay already issued and every guest is looking at, so asking for
    // it back by name is what survives a relay restart.
    const token = this.opts.token;
    const body: RelayControl = this.opts.asHost
      ? this.roomCode === ''
        ? { t: 'RelayCreateRoom', ...(token !== undefined ? { token } : {}) }
        : { t: 'RelayCreateRoom', code: this.roomCode, ...(token !== undefined ? { token } : {}) }
      : { t: 'RelayJoin', code: this.roomCode, ...(token !== undefined ? { token } : {}) };
    this.socket.send(envelope(this.roomCode, this.socket.connId() || 'new', 'all', 0, 0, body));
  }

  private receive(env: Envelope): void {
    const body = env.body as { t: string; code?: string; connId?: string; message?: string };
    switch (body.t) {
      case 'RelayRoomCreated':
        if (typeof body.code === 'string') this.roomCode = body.code;
        this.enterRoom();
        return;
      case 'RelayJoined':
        if (typeof body.code === 'string') this.roomCode = body.code;
        this.enterRoom();
        return;
      case 'RelayError': {
        const code = body.code ?? '';
        if (!this.inRoom) {
          // ⚠️ A host whose room still exists (its own socket died, the relay
          // did not) gets its create refused — the code is taken, by its own
          // room. The answer is to re-join and reclaim the host slot.
          if (code === 'roomTaken' && this.opts.asHost && !this.reclaimTried) {
            this.reclaimTried = true;
            this.socket.send(
              envelope(this.roomCode, this.socket.connId() || 'new', 'all', 0, 0, {
                t: 'RelayJoin',
                code: this.roomCode,
                asHost: true,
                ...(this.opts.token !== undefined ? { token: this.opts.token } : {}),
              }),
            );
            return;
          }
          // ⚠️ `noSuchRoom` is TRANSIENT and everything else is terminal. After
          // a relay restart the guests race the host's re-create and lose, and a
          // guest that gave up there would sit forever in a room that appeared
          // 200 ms later. `roomFull` and `protocolMismatch` must NOT retry —
          // a fifth player hammering the relay is a bug, not patience.
          if (code === 'noSuchRoom') {
            this.socket.reconnect();
            return;
          }
        }
        this.opts.onRelayError?.(code, body.message ?? '');
        return;
      }
      default:
        break;
    }
    for (const fn of [...this.messageFns]) fn(env);
  }

  private enterRoom(): void {
    if (this.inRoom) return;
    this.inRoom = true;
    const reconnected = this.handshakes > 0;
    this.handshakes += 1;
    // ⚠️ Drain BEFORE announcing ready, so anything queued while the room was
    // being established goes out ahead of the `Hello` that `ready` triggers.
    // The other order puts a client's first intent in front of its own hello.
    while (this.pending.length > 0) {
      const frame = this.pending.shift();
      if (frame) this.socket.send(frame);
    }
    for (const fn of [...this.readyFns]) fn(reconnected);
  }

  send(env: Envelope): void {
    if (this.closed) return;
    if (!this.inRoom) {
      this.pending.push(env);
      return;
    }
    this.socket.send(env);
  }

  onMessage(fn: (envelope: Envelope) => void): Unsubscribe {
    this.messageFns.push(fn);
    return () => {
      const at = this.messageFns.indexOf(fn);
      if (at >= 0) this.messageFns.splice(at, 1);
    };
  }

  onReady(fn: (reconnected: boolean) => void): Unsubscribe {
    this.readyFns.push(fn);
    if (this.inRoom) fn(this.handshakes > 1);
    return () => {
      const at = this.readyFns.indexOf(fn);
      if (at >= 0) this.readyFns.splice(at, 1);
    };
  }

  onClose(fn: (reason: string) => void): Unsubscribe {
    this.closeFns.push(fn);
    return () => {
      const at = this.closeFns.indexOf(fn);
      if (at >= 0) this.closeFns.splice(at, 1);
    };
  }

  close(reason = 'closed'): void {
    this.socket.close(reason);
  }

  status(): SocketStatus {
    return this.socket.currentStatus();
  }

  /**
   * Kill the underlying socket and let the backoff bring it back.
   *
   * ⚠️ INJECT THE FAILURE YOU CLAIM TO SURVIVE. `injectHungBeat()` exists in the
   * choreographer for exactly this reason: a queue that cannot survive one hung
   * beat strands a real player, and a transport that cannot survive one dropped
   * socket loses a real game. This is how a probe drops a live connection
   * without asking the operating system to do it.
   */
  dropSocket(): void {
    this.socket.reconnect();
  }
}

/** Wait until the link is in a room, so a caller can show the code. */
export function whenReady(link: RelayLink, timeoutMs = 15_000): Promise<RelayLink> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('The relay did not answer. Check the relay address, or host over your local network instead.'));
    }, timeoutMs);
    const off = link.onReady(() => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      off();
      resolve(link);
    });
  });
}
