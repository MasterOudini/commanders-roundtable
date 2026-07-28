// A host plus N clients in one process, wired through real loopback transports.
//
// ⚠️ NOT A TEST DOUBLE. This is the production path: `loopbackPair` is what the
// host's own player uses in a real game, and `HostSession`/`ClientSession` here
// are the same classes the app runs. The only thing the tests substitute is the
// card database, because the fixture set has to stay offline and deterministic.

import { ENGINE_CARDS } from '../../data/fixtures/engineCards';
import type { CardData } from '../../data/cardTypes';
import type { PrintingId } from '../../engine/types/ids';
import { ClientSession, type ClientOptions } from '../client';
import { HostSession, type DeckResolver, type HostOptions } from '../host';
import type { DeckSubmission } from '../protocol';
import { loopbackPair } from '../transport';
import type { Transport } from '../transport';

export const FIXTURE_ORACLE_VERSION = 'fixtures-2026-07-27';

const BY_PRINTING = new Map<PrintingId, CardData>(ENGINE_CARDS.map((c) => [c.scryfallId, c]));
const BY_NAME = new Map<string, CardData>(ENGINE_CARDS.map((c) => [c.name.toLowerCase(), c]));

export function fixtureCard(name: string): CardData {
  const card = BY_NAME.get(name.toLowerCase());
  if (!card) throw new Error(`no fixture card "${name}"`);
  return card;
}

export const fixtureResolver: DeckResolver = {
  resolve(ids) {
    const out = new Map<PrintingId, CardData>();
    for (const id of ids) {
      const card = BY_PRINTING.get(id);
      if (card) out.set(id, card);
    }
    return Promise.resolve(out);
  },
};

const COMMANDERS = [
  'Kess, Dissident Mage',
  'Krenko, Mob Boss',
  'Talrand, Sky Summoner',
  "Yeva, Nature's Herald",
];

const BASICS = ['Forest', 'Island', 'Mountain', 'Plains', 'Swamp'];

/**
 * ⚠️ Real creatures, not only basics.
 *
 * The first version dealt forty lands, which produced a game that never cast
 * anything, never attacked and never killed anybody — so "play a complete game
 * over the wire" tested land drops and priority passing and nothing else. Every
 * interesting piece of the projection (combat state, damage, commander damage,
 * deaths, the stack) only appears once creatures do.
 *
 * ⚠️ And a TARGETED spell, for the same reason one category later. Every card
 * above targets nothing, so `playFrom` never raised a `chooseTargets` prompt and
 * the whole targeting path — the prompt, the client's legality opinion, the
 * host's `validateTargets` — was invisible to this suite. It stayed invisible
 * long enough for `simplestIntent` to have no answer for that prompt at all,
 * which wedged `scripts/two-instance.cjs` while all 48 tests here stayed green.
 * A pool that cannot reach a code path is how that path rots.
 */
const SPELLS = [
  'Grizzly Bears',
  'Silvercoat Lion',
  'Raging Goblin',
  'Scathe Zombies',
  'Llanowar Elves',
  'Child of Night',
  'Typhoid Rats',
  'Sol Ring',
  'Lightning Bolt',
  'Air Elemental',
];

/** A deck of `size` cards, deterministic per seat: 60% lands, 40% spells. */
export function fixtureDeck(index: number, size = 40): DeckSubmission {
  const commander = fixtureCard(COMMANDERS[index % COMMANDERS.length] as string);
  const mainDeck: { oracleId: string; printingId: string }[] = [];
  for (let i = 0; i < size; i++) {
    const card =
      i % 5 < 3
        ? fixtureCard(BASICS[(i + index) % BASICS.length] as string)
        : fixtureCard(SPELLS[(i + index) % SPELLS.length] as string);
    mainDeck.push({ oracleId: card.oracleId, printingId: card.scryfallId });
  }
  return {
    name: `Deck ${index + 1}`,
    commanders: [{ oracleId: commander.oracleId, printingId: commander.scryfallId }],
    mainDeck,
  };
}

export interface TableClient {
  readonly session: ClientSession;
  readonly transport: Transport;
  readonly hostSide: Transport;
  readonly batches: { events: readonly unknown[]; hash: string }[];
  readonly snapshots: number[];
  readonly desyncs: unknown[];
  readonly errors: { code: string; message: string }[];
}

/** Let every pending microtask chain finish. One macrotask boundary is enough. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export interface TestTable {
  readonly host: HostSession;
  readonly clients: TableClient[];
  join(name: string, opts?: Partial<ClientOptions>): TableClient;
  /** Everyone submits a fixture deck, readies up, and the host starts. */
  startGame(deckSize?: number): Promise<{ ok: boolean; message: string }>;
}

export function makeTable(opts: Partial<HostOptions> = {}): TestTable {
  const host = new HostSession({
    roomCode: 'K7M2QX',
    hostName: 'Host',
    gameId: 'g-test',
    secret: 'test-secret-0123456789abcdef',
    appVersion: '0.4.0-test',
    oracleVersion: FIXTURE_ORACLE_VERSION,
    seed: 'net-test-seed',
    resolver: fixtureResolver,
    now: () => 1_700_000_000_000,
    ...opts,
  });

  const clients: TableClient[] = [];
  let nextConn = 0;

  const join = (name: string, extra: Partial<ClientOptions> = {}): TableClient => {
    const pair = loopbackPair('K7M2QX', `c${nextConn++}`);
    host.attach(pair.host);
    const entry: TableClient = {
      session: undefined as unknown as ClientSession,
      transport: pair.client,
      hostSide: pair.host,
      batches: [],
      snapshots: [],
      desyncs: [],
      errors: [],
    };
    const session = new ClientSession(pair.client, {
      playerName: name,
      appVersion: '0.4.0-test',
      oracleVersion: FIXTURE_ORACLE_VERSION,
      onBatch: (events, view) => {
        entry.batches.push({ events, hash: view.me });
      },
      onSnapshot: () => entry.snapshots.push(1),
      onDesync: (r) => entry.desyncs.push(r),
      onError: (code, message) => entry.errors.push({ code, message }),
      ...extra,
    });
    (entry as { session: ClientSession }).session = session;
    clients.push(entry);
    return entry;
  };

  return {
    host,
    clients,
    join,
    async startGame(deckSize = 40) {
      for (const [i, client] of clients.entries()) {
        client.session.submitDeck(fixtureDeck(i, deckSize));
      }
      // ⚠️ A MACROTASK, not `await Promise.resolve()`. Deck resolution is the
      // only asynchronous step in the whole protocol, and the host's inbox is
      // serial — so four submissions are four sequential promise chains, about
      // a dozen microtask turns deep in total. Awaiting a fixed number of
      // microtasks resolved two of them and left the other two unseated, which
      // surfaced as `start()` saying "Cy has no playable deck yet".
      await settle();
      for (const client of clients) client.session.setReady(true);
      return host.start();
    },
  };
}
