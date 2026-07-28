// A `Transport` over a real WebSocket — used for both the relay (`wss://…`) and
// a direct LAN connection (`ws://192.168.…:5282`).
//
// ⚠️ A SEND QUEUE NEEDS SOMEONE TO RESTART IT. A socket spends its first
// hundred milliseconds in CONNECTING, and `send()` throws there. Everything sent
// before `open` is buffered and flushed on `open` — and the flush also runs
// after a reconnect, because otherwise the frames queued while the socket was
// down sit there forever. This is the same shape as the art queue's D14a bug and
// the choreographer's `finally`, and it strands a real player when it is wrong.
//
// ⚠️ RECONNECT IS THE TRANSPORT'S JOB, NOT THE SESSION'S. The `ClientSession`
// above it only knows "a frame arrived"; it re-sends `Hello` with its
// `resumeToken` when it sees the socket come back, and the host answers with a
// `Snapshot`. Exponential backoff, 0.5 s → 8 s, so a relay restart costs one
// pause rather than a hammering loop.

import type { ConnId, Envelope } from './protocol';
import { isRoutable } from './protocol';
import type { Transport, Unsubscribe } from './transport';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface SocketOptions {
  readonly url: string;
  readonly room: string;
  /** Called when a fresh socket opens — including after a reconnect. */
  readonly onOpen?: (reconnected: boolean) => void;
  readonly onStatus?: (status: SocketStatus) => void;
  /** Injected for tests; the real one is `globalThis.WebSocket`. */
  readonly factory?: (url: string) => WebSocket;
  readonly maxBackoffMs?: number;
  readonly autoReconnect?: boolean;
}

const FIRST_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 8000;

export class SocketTransport implements Transport {
  closed = false;
  private socket: WebSocket | null = null;
  private id: ConnId = '';
  private readonly outbox: string[] = [];
  private readonly messageFns: ((envelope: Envelope) => void)[] = [];
  private readonly readyFns: ((reconnected: boolean) => void)[] = [];
  private readonly closeFns: ((reason: string) => void)[] = [];
  private backoff = FIRST_BACKOFF_MS;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private opened = 0;
  private status: SocketStatus = 'connecting';

  constructor(private readonly opts: SocketOptions) {
    this.connect();
  }

  get room(): string {
    return this.opts.room;
  }

  connId(): ConnId {
    return this.id;
  }

  /** Set from `RelayRoomCreated` / `RelayJoined`, which is where ids come from. */
  setConnId(id: ConnId): void {
    this.id = id;
  }

  currentStatus(): SocketStatus {
    return this.status;
  }

  private setStatus(status: SocketStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.opts.onStatus?.(status);
  }

  private connect(): void {
    if (this.closed) return;
    const make = this.opts.factory ?? ((url: string) => new WebSocket(url));
    let socket: WebSocket;
    try {
      socket = make(this.opts.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.setStatus(this.opened === 0 ? 'connecting' : 'reconnecting');

    socket.onopen = () => {
      this.backoff = FIRST_BACKOFF_MS;
      const reconnected = this.opened > 0;
      this.opened += 1;
      this.setStatus('open');
      this.flush();
      this.opts.onOpen?.(reconnected);
      for (const fn of [...this.readyFns]) fn(reconnected);
    };
    socket.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isRoutable(parsed)) return;
      const envelope = parsed;
      // The relay is the only thing that can tell us our own id, and it does so
      // exactly twice: when a room is created and when one is joined.
      const body = envelope.body as { t?: string; connId?: string };
      if ((body.t === 'RelayRoomCreated' || body.t === 'RelayJoined') && typeof body.connId === 'string') {
        this.id = body.connId;
      }
      for (const fn of [...this.messageFns]) fn(envelope);
    };
    socket.onclose = () => {
      this.socket = null;
      if (this.closed) return;
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      // `onclose` always follows, and it is the one that schedules the retry.
      // Reconnecting from both would double the rate on every failure.
    };
  }

  private scheduleReconnect(): void {
    if (this.closed || this.opts.autoReconnect === false) {
      this.finish('socket closed');
      return;
    }
    this.setStatus('reconnecting');
    if (this.timer !== null) return;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, this.opts.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, wait);
  }

  private flush(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) return;
    // ⚠️ Drain by shifting, so a `send` that happens DURING the flush (a
    // listener reacting to `open`) lands after the queue rather than being lost.
    while (this.outbox.length > 0) {
      const frame = this.outbox.shift();
      if (frame === undefined) break;
      socket.send(frame);
    }
  }

  send(envelope: Envelope): void {
    if (this.closed) return;
    this.outbox.push(JSON.stringify(envelope));
    this.flush();
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
    if (this.status === 'open') fn(this.opened > 1);
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

  /**
   * Drop the current socket and let the backoff bring it back.
   *
   * ⚠️ Not `close()`. A handshake that failed for a TRANSIENT reason — the host
   * has not re-created its room yet after a relay restart — must retry, and
   * `close()` is permanent by design. Without this, every guest in a game whose
   * relay bounced sits in a room that does not exist yet and never asks again.
   */
  reconnect(): void {
    if (this.closed) return;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onopen = null;
      socket.close();
    }
    this.scheduleReconnect();
  }

  close(reason = 'closed'): void {
    if (this.closed) return;
    this.closed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.socket?.close();
    this.socket = null;
    this.finish(reason);
  }

  private finish(reason: string): void {
    this.setStatus('closed');
    this.closed = true;
    for (const fn of [...this.closeFns]) fn(reason);
    this.closeFns.length = 0;
  }
}
