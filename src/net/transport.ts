// A transport is a pipe that carries `Envelope`s and knows nothing else.
//
// ⚠️ THE HOST'S OWN PLAYER GOES THROUGH ONE OF THESE TOO. That is the whole
// anti-accidental-cheating design (spec §7.6): the host UI holds a projected
// `PlayerView` obtained the same way a guest's is, so it has no privileged path
// to state and cannot show a library order even by mistake. It also means a test
// can run a host plus four clients in one process and play a complete game
// through the production code path — the highest-value integration test
// available, and it exists because of this one decision.
//
// ⚠️ A LOOPBACK PAIR DELIVERS SYNCHRONOUSLY. It is a function call; there is no
// wire. Introducing an artificial microtask "for realism" would make the host's
// own `submit()` return before the update it caused, which every caller in
// `src/ui/` would then have to work around — and the asynchrony a real socket
// has is already exercised by the relay tests.

import type { ConnId, Envelope } from './protocol';

export type Unsubscribe = () => void;

export interface Transport {
  readonly room: string;
  /** This end's connection id. Assigned by the relay for a real socket. */
  connId(): ConnId;
  send(envelope: Envelope): void;
  onMessage(fn: (envelope: Envelope) => void): Unsubscribe;
  /**
   * Fired when the pipe becomes usable, and again after every reconnect.
   *
   * ⚠️ This is what makes `ClientSession` transport-agnostic. A loopback pair is
   * usable the instant it exists, so it fires synchronously on subscribe; a
   * relay link is not usable until the ROOM handshake has completed, and a
   * `Hello` sent before that gets routed nowhere and looks like a host that
   * never answered. Both cases reduce to "say hello when told to".
   */
  onReady(fn: (reconnected: boolean) => void): Unsubscribe;
  /** Fired once, when the pipe can carry nothing more. */
  onClose(fn: (reason: string) => void): Unsubscribe;
  close(reason?: string): void;
  readonly closed: boolean;
}

/**
 * A minimal listener set.
 *
 * ⚠️ Iterates a COPY. A listener that unsubscribes itself while being notified
 * would otherwise skip the next one — which shows up as "the second client
 * never got the message" and looks exactly like a routing bug.
 */
class Listeners<T> {
  private fns: ((value: T) => void)[] = [];

  add(fn: (value: T) => void): Unsubscribe {
    this.fns.push(fn);
    return () => {
      this.fns = this.fns.filter((x) => x !== fn);
    };
  }

  emit(value: T): void {
    for (const fn of [...this.fns]) fn(value);
  }

  clear(): void {
    this.fns = [];
  }
}

class LoopbackEnd implements Transport {
  peer: LoopbackEnd | null = null;
  closed = false;
  private readonly messages = new Listeners<Envelope>();
  private readonly closes = new Listeners<string>();

  constructor(
    readonly room: string,
    private readonly id: ConnId,
  ) {}

  connId(): ConnId {
    return this.id;
  }

  send(envelope: Envelope): void {
    if (this.closed) return;
    const peer = this.peer;
    if (!peer || peer.closed) return;
    // ⚠️ The frame is copied. A loopback that shared object identity would let a
    // later mutation on one side alter what the other "received", which is a
    // class of bug a real socket cannot have — and the whole point of running
    // the host's own player through a transport is that it behaves like one.
    peer.messages.emit(JSON.parse(JSON.stringify(envelope)) as Envelope);
  }

  onMessage(fn: (envelope: Envelope) => void): Unsubscribe {
    return this.messages.add(fn);
  }

  /** A pipe with no wire is ready the moment it exists. */
  onReady(fn: (reconnected: boolean) => void): Unsubscribe {
    if (!this.closed) fn(false);
    return () => undefined;
  }

  onClose(fn: (reason: string) => void): Unsubscribe {
    return this.closes.add(fn);
  }

  close(reason = 'closed'): void {
    if (this.closed) return;
    this.closed = true;
    this.closes.emit(reason);
    const peer = this.peer;
    if (peer && !peer.closed) peer.close(reason);
    this.messages.clear();
  }
}

export interface LoopbackPair {
  /** Attach this end to the `HostSession`. */
  readonly host: Transport;
  /** Give this end to the `ClientSession`. */
  readonly client: Transport;
}

/**
 * A two-ended pipe carrying one client's frames to and from the host.
 *
 * Point to point, so `to: 'all'` and `to: <connId>` both mean "the other end" —
 * the host fans a broadcast out by sending it on every attached transport, which
 * is exactly what it does with a relay link too.
 */
export function loopbackPair(room: string, connId: ConnId): LoopbackPair {
  const host = new LoopbackEnd(room, 'host');
  const client = new LoopbackEnd(room, connId);
  host.peer = client;
  client.peer = host;
  return { host, client };
}
