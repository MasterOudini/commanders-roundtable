// The fixture table — M2's stand-in for the M3 rules engine.
//
// ⚠️ THIS IS NOT AN ENGINE AND MUST NOT BECOME ONE. It moves ids between zones
// and emits the matching events. It checks no legality, has no priority loop, no
// stack rules, no state-based actions and no randomness worth the name. Every
// method does exactly what it is told.
//
// Why it exists at all: M2's whole purpose is to get a judgement on whether the
// motion reads as MTG Arena BEFORE the engine exists. This workspace has two
// fully-built features that were reverted for looking wrong on real data, so
// getting that reaction now is far cheaper than after M3. The fixture produces
// exactly what the engine will produce — `(EngineEvent[], PlayerView)` pairs
// sharing a stepId — so in M3 the real engine replaces this file and the
// choreographer does not change at all. That seam is the deliverable, not this
// class.
//
// ⚠️ Keep every field this writes in step with `src/view/types.ts`. If a real
// projection ever produces a shape this cannot, the choreographer was tested
// against a lie.

import type { CardData, ColorLetter } from '../../data/cardTypes';
import {
  MANA_SYMBOLS,
  emptyView,
  zoneId,
  type CardView,
  type EngineEvent,
  type InstanceId,
  type LogEntry,
  type ManaSymbol,
  type PhaseId,
  type PlayerId,
  type PlayerView,
  type SeatView,
  type StackItemView,
  type ZoneId,
  type ZoneKind,
} from '../types';

export interface Batch {
  events: EngineEvent[];
  view: PlayerView;
}

interface Instance {
  instanceId: InstanceId;
  card: CardData;
  owner: PlayerId;
  controller: PlayerId;
  zone: ZoneId;
  tapped: boolean;
  summoningSick: boolean;
  damage: number;
  counters: Record<string, number>;
  faceDown: boolean;
  faceIndex: number;
  isCommander: boolean;
  isToken: boolean;
  attacking: PlayerId | null;
  blocking: InstanceId | null;
  attachedTo: InstanceId | null;
}

// The same names the real game seats with (`src/game/buildGame.ts`), so a
// fixture board and a live board never disagree about who is sitting where.
const SEAT_NAMES = ['Ana', 'Ben', 'Cy', 'Dee'];

export interface FixtureTableOptions {
  seatCount: 2 | 3 | 4;
  /** Real cards from the index when available; hand-written fixtures otherwise. */
  pool: CardData[];
  /** Whose view is produced. Always a real seat. */
  me?: PlayerId;
}

export class FixtureTable {
  private readonly pool: CardData[];
  private readonly me: PlayerId;
  private readonly players: PlayerId[];
  private readonly instances = new Map<InstanceId, Instance>();
  private readonly zones = new Map<ZoneId, InstanceId[]>();
  private readonly seats = new Map<PlayerId, SeatView>();
  private stack: StackItemView[] = [];
  private log: LogEntry[] = [];
  private turn = { active: 'p1' as PlayerId, phase: 'main1' as PhaseId, turnNumber: 1 };
  private priority: PlayerId | null = 'p1';
  private stepId = 0;
  private nextInstance = 1;
  private nextStackItem = 1;
  private nextLogId = 1;
  /** Identity-preserving caches — see the note on `view()`. */
  private readonly lastCards = new Map<InstanceId, CardView>();
  private readonly lastSeats = new Map<PlayerId, SeatView>();
  private readonly lastZones = new Map<ZoneId, InstanceId[]>();

  constructor(opts: FixtureTableOptions) {
    this.pool = opts.pool.length > 0 ? opts.pool : [];
    this.players = Array.from({ length: opts.seatCount }, (_, i) => `p${i + 1}`);
    this.me = opts.me ?? 'p1';
    this.turn.active = this.players[0]!;
    this.priority = this.players[0]!;

    for (const [i, id] of this.players.entries()) {
      this.seats.set(id, {
        playerId: id,
        name: SEAT_NAMES[i] ?? `Player ${i + 1}`,
        life: 40,
        cmdDamage: Object.fromEntries(this.players.map((p) => [p, 0])),
        poison: 0,
        manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        identity: [],
        lost: false,
      });
    }
  }

  // ── plumbing ───────────────────────────────────────────────────────────────

  private zone(id: ZoneId): InstanceId[] {
    let arr = this.zones.get(id);
    if (!arr) {
      arr = [];
      this.zones.set(id, arr);
    }
    return arr;
  }

  private pick(index: number): CardData {
    if (this.pool.length === 0) throw new Error('FixtureTable needs a non-empty card pool');
    return this.pool[index % this.pool.length]!;
  }

  /** Create an instance directly in a zone. Emits nothing — setup only. */
  place(card: CardData, zone: ZoneId, over: Partial<Instance> = {}): InstanceId {
    const { player } = splitZone(zone);
    const instanceId = `i${this.nextInstance++}`;
    const inst: Instance = {
      instanceId,
      card,
      owner: player ?? this.me,
      controller: player ?? this.me,
      zone,
      tapped: false,
      summoningSick: false,
      damage: 0,
      counters: {},
      faceDown: false,
      faceIndex: 0,
      isCommander: false,
      isToken: false,
      attacking: null,
      blocking: null,
      attachedTo: null,
      ...over,
    };
    this.instances.set(instanceId, inst);
    this.zone(zone).push(instanceId);
    return instanceId;
  }

  private move(instanceId: InstanceId, to: ZoneId): ZoneId | null {
    const inst = this.instances.get(instanceId);
    if (!inst) return null;
    const from = inst.zone;
    const src = this.zone(from);
    const at = src.indexOf(instanceId);
    if (at >= 0) src.splice(at, 1);
    inst.zone = to;
    const { player } = splitZone(to);
    if (player) inst.controller = player;
    // Leaving the battlefield clears everything that only exists there. A real
    // engine does this in a state-based-action pass; here it is just correctness
    // for the view.
    if (!to.startsWith('bf:')) {
      inst.tapped = false;
      inst.damage = 0;
      inst.attacking = null;
      inst.blocking = null;
      inst.summoningSick = false;
      inst.counters = {};
    }
    this.zone(to).push(instanceId);
    return from;
  }

  private logLine(
    text: string,
    player: PlayerId | null = null,
    identity: ColorLetter[] = [],
    manual = false,
  ): LogEntry {
    const entry: LogEntry = { id: this.nextLogId++, text, player, identity, manual };
    this.log = [...this.log, entry].slice(-200);
    return entry;
  }

  /**
   * Build the projected view for `me`. This is the shape `project()` must match.
   *
   * ⚠️ IT PRESERVES REFERENTIAL IDENTITY for anything that did not change, and M3's
   * real `project()` MUST do the same. This is not a micro-optimisation — it is the
   * difference between a commit costing one card's worth of work and costing the
   * whole table's.
   *
   * Measured before this was added, on a 4-player board: every single view commit
   * produced ONE long frame, and its duration scaled with the card count — 33 ms at
   * 2 permanents per seat, 58 ms at 10, 83 ms at 20. The long-frame COUNT tracked the
   * commit count exactly, even for pure phase changes that animate nothing at all.
   * Committing a shallow COPY of the same view produced zero long frames. The cause
   * was that every CardView was a fresh object each call, so `React.memo` on Card
   * could never match and all ~50 cards re-rendered and restyled on every commit.
   */
  view(): PlayerView {
    const base = emptyView(this.me);
    const cards: Record<InstanceId, CardView> = {};
    const zones: PlayerView['zones'] = {};
    const hiddenCounts: PlayerView['hiddenCounts'] = {};

    for (const [id, ids] of this.zones) {
      if (ids.length === 0) continue;
      const prev = this.lastZones.get(id);
      const reused = prev && sameIds(prev, ids) ? prev : [...ids];
      this.lastZones.set(id, reused);
      zones[id] = reused;
    }

    for (const inst of this.instances.values()) {
      const hidden = this.isHidden(inst);
      const next: CardView = {
        instanceId: inst.instanceId,
        // ⚠️ Hiddenness is the ABSENCE of data, never a flag the UI must remember
        // to honour. A component physically cannot leak an opponent's hand.
        card: hidden ? null : inst.card,
        faceIndex: inst.faceIndex,
        faceDown: hidden || inst.faceDown,
        controller: inst.controller,
        owner: inst.owner,
        tapped: inst.tapped,
        summoningSick: inst.summoningSick,
        damage: inst.damage,
        counters: { ...inst.counters },
        power: derivedPower(inst),
        toughness: derivedToughness(inst),
        attachedTo: inst.attachedTo,
        isCommander: inst.isCommander,
        isToken: inst.isToken,
        attacking: inst.attacking,
        blocking: inst.blocking,
      };
      const prev = this.lastCards.get(inst.instanceId);
      const reused = prev && sameCardView(prev, next) ? prev : next;
      this.lastCards.set(inst.instanceId, reused);
      cards[inst.instanceId] = reused;
    }
    // Drop cache entries for instances that no longer exist (tokens ceasing to be).
    for (const id of [...this.lastCards.keys()]) {
      if (!this.instances.has(id)) this.lastCards.delete(id);
    }

    for (const p of this.players) {
      hiddenCounts[zoneId('lib', p)] = this.zone(zoneId('lib', p)).length;
      if (p !== this.me) hiddenCounts[zoneId('hand', p)] = this.zone(zoneId('hand', p)).length;
    }

    return {
      ...base,
      seatOrder: [...this.players],
      seats: Object.fromEntries(
        [...this.seats].map(([k, v]) => {
          const prev = this.lastSeats.get(k);
          const reused = prev && sameSeatView(prev, v) ? prev : { ...v };
          this.lastSeats.set(k, reused);
          return [k, reused];
        }),
      ),
      cards,
      zones,
      stack: this.stack.map((s) => ({ ...s })),
      turn: { ...this.turn },
      priority: this.priority,
      log: [...this.log],
      hiddenCounts,
    };
  }

  /** A library is never visible; another player's hand never is. */
  private isHidden(inst: Instance): boolean {
    const { kind, player } = splitZone(inst.zone);
    if (kind === 'lib') return true;
    if (kind === 'hand') return player !== this.me;
    if (inst.faceDown) return player !== this.me;
    return false;
  }

  private batch(events: EngineEvent[]): Batch {
    return { events, view: this.view() };
  }

  private step(): number {
    return ++this.stepId;
  }

  // ── setup ──────────────────────────────────────────────────────────────────

  /**
   * Deal a plausible mid-game board: a library, a hand, and `permanents` split
   * across the seats with lands deliberately duplicated so auto-stacking has
   * something real to do.
   */
  setup(opts: { permanentsPerSeat: number; handSize: number; librarySize?: number }): PlayerView {
    const librarySize = opts.librarySize ?? 60;
    const lands = this.pool.filter((c) => /\bLand\b/.test(c.faces[0]!.typeLine));
    const nonLands = this.pool.filter((c) => !/\bLand\b/.test(c.faces[0]!.typeLine));
    const creatures = nonLands.filter((c) => /\bCreature\b/.test(c.faces[0]!.typeLine));
    const others = nonLands.filter((c) => !/\bCreature\b/.test(c.faces[0]!.typeLine));
    const landPool = lands.length > 0 ? lands : this.pool;
    const creaturePool = creatures.length > 0 ? creatures : this.pool;
    const otherPool = others.length > 0 ? others : this.pool;

    // ⚠️ PER SEAT, not a total split across seats. The earlier signature took a
    // total, which made "a 40-permanent board" mean 10 permanents each at 4
    // players — a third of a real Commander board (the spec's own figure is 10
    // lands + 6 other noncreatures + 5 creatures = 21 EACH). A stress test that
    // renders a third of the real load is not a stress test.
    const perSeat = Math.max(1, Math.floor(opts.permanentsPerSeat));

    for (const [seatIndex, p] of this.players.entries()) {
      for (let i = 0; i < librarySize; i++) {
        this.place(this.pick(seatIndex * 7 + i), zoneId('lib', p));
      }

      // A commander, in the command zone, so every pod has a colour identity.
      const cmd = creaturePool[seatIndex % creaturePool.length]!;
      this.place(cmd, zoneId('cmd', p), { isCommander: true });
      const seat = this.seats.get(p)!;
      seat.identity = [...cmd.colorIdentity];

      // A real Commander board: mostly lands, several of them identical.
      const landCount = Math.max(1, Math.round(perSeat * 0.5));
      const creatureCount = Math.max(1, Math.round(perSeat * 0.28));
      const otherCount = Math.max(0, perSeat - landCount - creatureCount);

      // Duplicating ONE basic land many times is the point: it is what
      // auto-stacking has to collapse for a 4-player board to fit at 1080p.
      const basic = landPool[seatIndex % landPool.length]!;
      for (let i = 0; i < landCount; i++) {
        this.place(basic, zoneId('bf', p), { tapped: i % 5 === 4 });
      }
      for (let i = 0; i < creatureCount; i++) {
        this.place(creaturePool[(seatIndex * 3 + i) % creaturePool.length]!, zoneId('bf', p), {
          summoningSick: i === creatureCount - 1 && p === this.me,
        });
      }
      for (let i = 0; i < otherCount; i++) {
        this.place(otherPool[(seatIndex * 5 + i) % otherPool.length]!, zoneId('bf', p), {
          tapped: i % 3 === 0,
        });
      }

      for (let i = 0; i < opts.handSize; i++) {
        this.place(this.pick(seatIndex * 11 + i + 3), zoneId('hand', p));
      }

      // A couple of cards in the graveyard, so the pile is not empty on arrival.
      for (let i = 0; i < 2; i++) {
        this.place(this.pick(seatIndex * 13 + i), zoneId('gy', p));
      }
    }

    this.logLine('Game started. 40 life each.');
    return this.view();
  }

  // ── actions, each emitting the events a real engine would ───────────────────

  draw(player: PlayerId, count = 1): Batch {
    const stepId = this.step();
    const events: EngineEvent[] = [];
    const lib = this.zone(zoneId('lib', player));
    for (let i = 0; i < count; i++) {
      const instanceId = lib[lib.length - 1];
      if (!instanceId) break;
      this.move(instanceId, zoneId('hand', player));
      events.push({ t: 'CardDrawn', stepId, player, instanceId });
    }
    const seat = this.seats.get(player)!;
    const entry = this.logLine(`${seat.name} draws ${events.length} card${events.length === 1 ? '' : 's'}.`, player);
    events.push({ t: 'Logged', stepId, entry });
    return this.batch(events);
  }

  moveCard(instanceId: InstanceId, kind: ZoneKind, player?: PlayerId, manual = false): Batch {
    const stepId = this.step();
    const inst = this.instances.get(instanceId);
    if (!inst) return this.batch([]);
    const to = zoneId(kind, player ?? inst.controller);
    const from = this.move(instanceId, to);
    if (from === null) return this.batch([]);
    const faceUpAtEnd = !this.isHidden(inst);
    const entry = this.logLine(
      `${inst.card.name} → ${kind}.`,
      inst.controller,
      inst.card.colorIdentity,
      manual,
    );
    return this.batch([
      { t: 'CardMoved', stepId, instanceId, from, to, faceUpAtEnd },
      { t: 'Logged', stepId, entry },
    ]);
  }

  cast(instanceId: InstanceId): Batch {
    const stepId = this.step();
    const inst = this.instances.get(instanceId);
    if (!inst) return this.batch([]);
    const from = inst.zone;
    const controller = inst.controller;
    this.move(instanceId, 'stack');
    const stackItemId = `st${this.nextStackItem++}`;
    this.stack.push({
      stackItemId,
      instanceId,
      label: inst.card.name,
      controller,
      identity: [...inst.card.colorIdentity],
      targets: [],
    });
    const entry = this.logLine(
      `${this.seats.get(controller)!.name} casts ${inst.card.name}.`,
      controller,
      inst.card.colorIdentity,
    );
    return this.batch([
      { t: 'SpellCast', stepId, instanceId, from, controller, stackItemId },
      { t: 'Logged', stepId, entry },
    ]);
  }

  /** Resolve the top of the stack: permanents land, everything else is binned. */
  resolveTop(): Batch {
    const stepId = this.step();
    const item = this.stack.pop();
    if (!item) return this.batch([]);
    const events: EngineEvent[] = [];

    if (item.instanceId) {
      const inst = this.instances.get(item.instanceId);
      if (inst) {
        const type = inst.card.faces[0]!.typeLine;
        const isPermanent = /\b(Creature|Artifact|Enchantment|Land|Planeswalker|Battle)\b/.test(type);
        const to = isPermanent ? zoneId('bf', inst.controller) : zoneId('gy', inst.owner);
        this.move(item.instanceId, to);
        const isLand = /\bLand\b/.test(type);
        if (isPermanent && /\bCreature\b/.test(type)) inst.summoningSick = true;
        events.push({ t: 'StackResolved', stepId, stackItemId: item.stackItemId, instanceId: item.instanceId, to, targets: [] });
        if (isPermanent) {
          events.push({ t: 'PermanentEntered', stepId, instanceId: item.instanceId, isLand });
        }
      }
    } else {
      events.push({ t: 'StackResolved', stepId, stackItemId: item.stackItemId, instanceId: null, to: null, targets: [] });
    }

    const entry = this.logLine(`${item.label} resolves.`, item.controller, item.identity);
    events.push({ t: 'Logged', stepId, entry });
    return this.batch(events);
  }

  /** Play a land straight to the battlefield — the quiet 200 ms beat. */
  playLand(instanceId: InstanceId): Batch {
    const stepId = this.step();
    const inst = this.instances.get(instanceId);
    if (!inst) return this.batch([]);
    const from = this.move(instanceId, zoneId('bf', inst.controller));
    if (from === null) return this.batch([]);
    const entry = this.logLine(
      `${this.seats.get(inst.controller)!.name} plays ${inst.card.name}.`,
      inst.controller,
      inst.card.colorIdentity,
    );
    return this.batch([
      { t: 'CardMoved', stepId, instanceId, from, to: inst.zone, faceUpAtEnd: true },
      { t: 'PermanentEntered', stepId, instanceId, isLand: true },
      { t: 'Logged', stepId, entry },
    ]);
  }

  tap(instanceIds: InstanceId[]): Batch {
    const stepId = this.step();
    const events: EngineEvent[] = [];
    for (const instanceId of instanceIds) {
      const inst = this.instances.get(instanceId);
      if (!inst || inst.tapped) continue;
      inst.tapped = true;
      events.push({ t: 'PermanentTapped', stepId, instanceId });
    }
    return this.batch(events);
  }

  untapAll(player: PlayerId): Batch {
    const stepId = this.step();
    const events: EngineEvent[] = [];
    for (const instanceId of this.zone(zoneId('bf', player))) {
      const inst = this.instances.get(instanceId);
      if (!inst || !inst.tapped) continue;
      inst.tapped = false;
      events.push({ t: 'PermanentUntapped', stepId, instanceId });
    }
    return this.batch(events);
  }

  addMana(player: PlayerId, symbol: ManaSymbol, amount = 1): Batch {
    const stepId = this.step();
    const seat = this.seats.get(player)!;
    seat.manaPool = { ...seat.manaPool, [symbol]: seat.manaPool[symbol] + amount };
    return this.batch([{ t: 'ManaAdded', stepId, player, symbol, amount }]);
  }

  emptyManaPool(player: PlayerId): Batch {
    const stepId = this.step();
    const seat = this.seats.get(player)!;
    seat.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    return this.batch([{ t: 'ManaPoolEmptied', stepId, player }]);
  }

  changeLife(player: PlayerId, delta: number): Batch {
    const stepId = this.step();
    const seat = this.seats.get(player)!;
    const from = seat.life;
    seat.life = from + delta;
    const events: EngineEvent[] = [
      { t: 'LifeChanged', stepId, player, from, to: seat.life },
    ];
    if (seat.life <= 0 && !seat.lost) {
      seat.lost = true;
      events.push({ t: 'PlayerLost', stepId, player, reason: '0 life' });
    }
    return this.batch(events);
  }

  damagePlayer(
    player: PlayerId,
    amount: number,
    opts: { commander?: boolean; source?: InstanceId | null } = {},
  ): Batch {
    const stepId = this.step();
    const seat = this.seats.get(player)!;
    const from = seat.life;
    seat.life = from - amount;
    const events: EngineEvent[] = [
      {
        t: 'DamageDealt',
        stepId,
        target: player,
        targetKind: 'player',
        amount,
        commander: opts.commander ?? false,
        source: opts.source ?? null,
      },
      { t: 'LifeChanged', stepId, player, from, to: seat.life },
    ];
    if (opts.commander && opts.source) {
      const src = this.instances.get(opts.source);
      if (src) {
        seat.cmdDamage = {
          ...seat.cmdDamage,
          [src.controller]: (seat.cmdDamage[src.controller] ?? 0) + amount,
        };
      }
    }
    if (seat.life <= 0 && !seat.lost) {
      seat.lost = true;
      events.push({ t: 'PlayerLost', stepId, player, reason: '0 life' });
    }
    return this.batch(events);
  }

  damageCard(instanceId: InstanceId, amount: number): Batch {
    const stepId = this.step();
    const inst = this.instances.get(instanceId);
    if (!inst) return this.batch([]);
    inst.damage += amount;
    return this.batch([
      {
        t: 'DamageDealt',
        stepId,
        target: instanceId,
        targetKind: 'card',
        amount,
        commander: false,
        source: null,
      },
    ]);
  }

  counter(instanceId: InstanceId, kind: string, delta: number): Batch {
    const stepId = this.step();
    const inst = this.instances.get(instanceId);
    if (!inst) return this.batch([]);
    inst.counters = { ...inst.counters, [kind]: (inst.counters[kind] ?? 0) + delta };
    if (inst.counters[kind] === 0) delete inst.counters[kind];
    return this.batch([{ t: 'CounterChanged', stepId, instanceId, kind, delta }]);
  }

  declareAttackers(pairs: { instanceId: InstanceId; defender: PlayerId }[]): Batch {
    const stepId = this.step();
    const attackers: { instanceId: InstanceId; defender: PlayerId }[] = [];
    for (const { instanceId, defender } of pairs) {
      const inst = this.instances.get(instanceId);
      if (!inst) continue;
      inst.attacking = defender;
      attackers.push({ instanceId, defender });
    }
    const entry = this.logLine(`${attackers.length} attacker${attackers.length === 1 ? '' : 's'} declared.`);
    return this.batch([
      { t: 'AttackersDeclared', stepId, attackers },
      { t: 'Logged', stepId, entry },
    ]);
  }

  declareBlockers(blocks: { blocker: InstanceId; attacker: InstanceId }[]): Batch {
    const stepId = this.step();
    const applied: { blocker: InstanceId; attacker: InstanceId }[] = [];
    for (const b of blocks) {
      const inst = this.instances.get(b.blocker);
      if (!inst) continue;
      inst.blocking = b.attacker;
      applied.push(b);
    }
    const entry = this.logLine(`${applied.length} blocker${applied.length === 1 ? '' : 's'} declared.`);
    return this.batch([
      { t: 'BlockersDeclared', stepId, blocks: applied },
      { t: 'Logged', stepId, entry },
    ]);
  }

  /** Combat damage is SIMULTANEOUS — one group, several punches at once. */
  combatDamage(
    hits: { target: string; targetKind: 'card' | 'player'; amount: number; source: InstanceId; commander?: boolean }[],
  ): Batch {
    const stepId = this.step();
    const events: EngineEvent[] = [];
    for (const hit of hits) {
      events.push({
        t: 'DamageDealt',
        stepId,
        target: hit.target,
        targetKind: hit.targetKind,
        amount: hit.amount,
        commander: hit.commander ?? false,
        source: hit.source,
      });
      if (hit.targetKind === 'player') {
        const seat = this.seats.get(hit.target);
        if (seat) {
          const from = seat.life;
          seat.life = from - hit.amount;
          events.push({ t: 'LifeChanged', stepId, player: hit.target, from, to: seat.life });
          if (hit.commander) {
            const src = this.instances.get(hit.source);
            if (src) {
              seat.cmdDamage = {
                ...seat.cmdDamage,
                [src.controller]: (seat.cmdDamage[src.controller] ?? 0) + hit.amount,
              };
            }
          }
        }
      } else {
        const inst = this.instances.get(hit.target);
        if (inst) inst.damage += hit.amount;
      }
    }
    const entry = this.logLine('Combat damage.');
    events.push({ t: 'Logged', stepId, entry });
    return this.batch(events);
  }

  /** Lethal damage: the death beat, then the flight to the graveyard. */
  destroy(instanceIds: InstanceId[]): Batch {
    const stepId = this.step();
    const events: EngineEvent[] = [];
    for (const instanceId of instanceIds) {
      const inst = this.instances.get(instanceId);
      if (!inst) continue;
      const name = inst.card.name;
      const identity = [...inst.card.colorIdentity];
      const from = inst.zone;
      // A token ceases to exist rather than reaching the graveyard, so it gets the
      // death beat and no flight.
      const to = inst.isToken ? from : zoneId('gy', inst.owner);
      if (!inst.isToken) this.move(instanceId, to);
      else this.instances.delete(instanceId), this.removeFromZone(instanceId, from);
      events.push({ t: 'PermanentDied', stepId, instanceId });
      const entry = this.logLine(`${name} dies.`, inst.controller, identity);
      events.push({ t: 'Logged', stepId, entry });
    }
    return this.batch(events);
  }

  private removeFromZone(instanceId: InstanceId, zone: ZoneId): void {
    const arr = this.zone(zone);
    const at = arr.indexOf(instanceId);
    if (at >= 0) arr.splice(at, 1);
  }

  createToken(player: PlayerId, card: CardData, count = 1): Batch {
    const stepId = this.step();
    const events: EngineEvent[] = [];
    for (let i = 0; i < count; i++) {
      const instanceId = this.place(card, zoneId('bf', player), {
        isToken: true,
        summoningSick: true,
      });
      events.push({ t: 'TokenCreated', stepId, instanceId });
    }
    const entry = this.logLine(
      `${this.seats.get(player)!.name} creates ${count} ${card.name} token${count === 1 ? '' : 's'}.`,
      player,
      card.colorIdentity,
    );
    events.push({ t: 'Logged', stepId, entry });
    return this.batch(events);
  }

  reveal(instanceId: InstanceId): Batch {
    const stepId = this.step();
    const inst = this.instances.get(instanceId);
    if (!inst) return this.batch([]);
    inst.faceDown = false;
    const entry = this.logLine(`${inst.card.name} is revealed.`, inst.controller, inst.card.colorIdentity);
    return this.batch([
      { t: 'CardRevealed', stepId, instanceId },
      { t: 'Logged', stepId, entry },
    ]);
  }

  setPhase(phase: PhaseId, active?: PlayerId): Batch {
    const stepId = this.step();
    if (active) this.turn.active = active;
    if (phase === 'untap' && active) this.turn.turnNumber++;
    this.turn.phase = phase;
    return this.batch([
      { t: 'PhaseChanged', stepId, phase, turnNumber: this.turn.turnNumber, active: this.turn.active },
    ]);
  }

  setPriority(player: PlayerId | null): Batch {
    const stepId = this.step();
    this.priority = player;
    return this.batch([{ t: 'PriorityChanged', stepId, player }]);
  }

  // ── read helpers for scenarios and probes ──────────────────────────────────

  playerIds(): PlayerId[] {
    return [...this.players];
  }

  in(kind: ZoneKind, player: PlayerId): InstanceId[] {
    return [...this.zone(zoneId(kind, player))];
  }

  /** Battlefield creatures, for building a combat scenario. */
  creaturesOf(player: PlayerId): InstanceId[] {
    return this.zone(zoneId('bf', player)).filter((id) => {
      const inst = this.instances.get(id);
      return !!inst && /\bCreature\b/.test(inst.card.faces[0]!.typeLine);
    });
  }

  cardOf(instanceId: InstanceId): CardData | null {
    return this.instances.get(instanceId)?.card ?? null;
  }

  currentStepId(): number {
    return this.stepId;
  }
}

function sameIds(a: readonly InstanceId[], b: readonly InstanceId[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameCounters(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/** Field-by-field, because a shallow object compare is exactly what fails here. */
function sameCardView(a: CardView, b: CardView): boolean {
  return (
    a.card === b.card &&
    a.faceIndex === b.faceIndex &&
    a.faceDown === b.faceDown &&
    a.controller === b.controller &&
    a.owner === b.owner &&
    a.tapped === b.tapped &&
    a.summoningSick === b.summoningSick &&
    a.damage === b.damage &&
    a.power === b.power &&
    a.toughness === b.toughness &&
    a.attachedTo === b.attachedTo &&
    a.isCommander === b.isCommander &&
    a.isToken === b.isToken &&
    a.attacking === b.attacking &&
    a.blocking === b.blocking &&
    sameCounters(a.counters, b.counters)
  );
}

function sameSeatView(a: SeatView, b: SeatView): boolean {
  return (
    a.name === b.name &&
    a.life === b.life &&
    a.lost === b.lost &&
    sameIds(a.identity, b.identity) &&
    sameCounters(a.cmdDamage as Record<string, number>, b.cmdDamage as Record<string, number>) &&
    sameCounters(
      a.manaPool as unknown as Record<string, number>,
      b.manaPool as unknown as Record<string, number>,
    )
  );
}

function splitZone(id: ZoneId): { kind: ZoneKind | 'stack'; player: PlayerId | null } {
  if (id === 'stack') return { kind: 'stack', player: null };
  const cut = id.indexOf(':');
  return { kind: id.slice(0, cut) as ZoneKind, player: id.slice(cut + 1) };
}

/**
 * Current power, printed value plus +1/+1 counters.
 *
 * A real `derive()` runs the CR layer pipeline; this covers layers 1 and 7b, which
 * is everything the CHROME needs to be exercised — the point is that the badge
 * shows the current value and highlights when it differs from the printed one.
 */
function derivedPower(inst: Instance): number | null {
  const printed = Number(inst.card.faces[inst.faceIndex]?.power ?? inst.card.faces[0]?.power);
  if (!Number.isFinite(printed)) return null;
  return printed + (inst.counters['+1/+1'] ?? 0);
}

function derivedToughness(inst: Instance): number | null {
  const printed = Number(inst.card.faces[inst.faceIndex]?.toughness ?? inst.card.faces[0]?.toughness);
  if (!Number.isFinite(printed)) return null;
  return printed + (inst.counters['+1/+1'] ?? 0);
}

export { MANA_SYMBOLS };
export type { ManaSymbol };
