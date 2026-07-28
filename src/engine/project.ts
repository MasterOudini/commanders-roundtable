// `project(state, viewer) → PlayerView`. THE ENTIRE HIDDEN-INFORMATION
// BOUNDARY. A bug in this file leaks hands.
//
// ⚠️ HIDDENNESS IS THE ABSENCE OF DATA, never a flag. `CardView.card === null`
// for anything the viewer may not see, and the renderer is physically incapable
// of leaking what it was never given. A `hidden: true` flag would work exactly
// as well right up until one component forgot to check it.
//
// ⚠️ A LIBRARY IS A COUNT, FULL STOP — including your own. The host process
// holds the shuffled order in memory, and `project()` strips it, so the game UI
// (which reads only the view) cannot show it even by accident. That is what
// makes accidental cheating structurally impossible rather than a matter of
// discipline.
//
// ⚠️ REFERENTIAL IDENTITY IS A HARD REQUIREMENT (D21), not an optimisation.
// Measured in M2: before the projection reused unchanged objects, EVERY view
// commit produced exactly one long frame, and its duration scaled with the
// board — 33 ms at 2 permanents per seat, 58 ms at 10, 83 ms at 20 — even for a
// pure phase change that animates nothing. The cause was that every `CardView`
// was a fresh object, so `React.memo` on `Card` could never match and all ~50
// cards re-rendered and restyled. Field-by-field comparison, because a shallow
// object compare is precisely what fails here.

import type { CardData, ColorLetter } from '../data/cardTypes';
import { derive, makeDeriveCache } from './derive';
import { render } from './narrate';
import type { ScriptRegistry } from './scripts/registry';
import type { InstanceId, PlayerId } from './types/ids';
import type { OracleDb } from './types/oracle';
import type { CardInstance, GameState, Step } from './types/state';
import {
  emptyView,
  zoneId,
  type CardView,
  type LogEntry,
  type ManaSymbol,
  type PhaseId,
  type PlayerView,
  type SeatView,
  type StackItemView,
  type ZoneId,
} from '../view/types';

const STEP_TO_PHASE: Readonly<Record<Step, PhaseId>> = {
  untap: 'untap',
  upkeep: 'upkeep',
  draw: 'draw',
  precombatMain: 'main1',
  beginCombat: 'beginCombat',
  declareAttackers: 'attackers',
  declareBlockers: 'blockers',
  firstStrikeDamage: 'combatDamage',
  combatDamage: 'combatDamage',
  endCombat: 'endCombat',
  postcombatMain: 'main2',
  end: 'end',
  cleanup: 'cleanup',
};

/**
 * Per-viewer projector. Holds the identity caches, so it must be kept alive
 * across commits — constructing a fresh one every frame is exactly the bug D21
 * describes.
 */
export class Projector {
  private readonly lastCards = new Map<InstanceId, CardView>();
  private readonly lastSeats = new Map<PlayerId, SeatView>();
  private readonly lastZones = new Map<ZoneId, InstanceId[]>();
  /** Rendered log rows by line id. A narration line never changes once written. */
  private readonly lastLog = new Map<number, LogEntry>();

  constructor(
    private readonly oracle: OracleDb,
    private readonly scripts: ScriptRegistry,
    readonly viewer: PlayerId,
  ) {}

  project(state: GameState): PlayerView {
    const viewer = this.viewer;
    const cache = makeDeriveCache(state);
    const base = emptyView(viewer);

    const cards: Record<InstanceId, CardView> = {};
    const zones: PlayerView['zones'] = {};
    const hiddenCounts: PlayerView['hiddenCounts'] = {};

    // Clockwise from the viewer, so "my seat is at the bottom" needs no special
    // case in the layout.
    const at = Math.max(0, state.seating.indexOf(viewer));
    const seatOrder = state.seating.map((_, i) => state.seating[(at + i) % state.seating.length] ?? '');

    const attacking = new Map<InstanceId, PlayerId>();
    const blocking = new Map<InstanceId, InstanceId>();
    if (state.combat) {
      for (const a of state.combat.attackers) {
        const defender =
          a.defender.kind === 'player' ? a.defender.id : (state.cards[a.defender.id]?.controller ?? '');
        attacking.set(a.card, defender);
      }
      for (const b of state.combat.blockers) {
        const first = b.attackerOrder[0];
        if (first) blocking.set(b.card, first);
      }
    }

    const emit = (inst: CardInstance): void => {
      const visible = this.canSee(inst);
      const oracleCard = visible ? this.oracle.byPrinting(inst.printingId) : undefined;
      const d = derive(state, this.oracle, this.scripts, inst.id, cache);
      const next: CardView = {
        instanceId: inst.id,
        card: (oracleCard?.data ?? null) as CardData | null,
        faceIndex: inst.faceIndex,
        faceDown: !visible || inst.faceDown,
        controller: inst.controller,
        owner: inst.owner,
        tapped: inst.tapped,
        summoningSick:
          d.isCreature &&
          inst.summonedOnTurn !== null &&
          inst.summonedOnTurn >= state.turn.turnNumber &&
          !d.keywords.has('haste'),
        damage: inst.damage,
        counters: inst.counters as Record<string, number>,
        // A face-down permanent is a public 2/2 whose IDENTITY is hidden, so its
        // derived P/T is shown to everyone. That is CR 708.2, and it is also
        // what stops a face-down blocker from rendering as a blank.
        power: d.isCreature ? d.power : null,
        toughness: d.isCreature ? d.toughness : null,
        attachedTo: inst.attachedTo,
        isCommander: inst.isCommander,
        isToken: inst.isToken,
        attacking: attacking.get(inst.id) ?? null,
        blocking: blocking.get(inst.id) ?? null,
      };
      const prev = this.lastCards.get(inst.id);
      const reused = prev && sameCardView(prev, next) ? prev : next;
      this.lastCards.set(inst.id, reused);
      cards[inst.id] = reused;
    };

    const putZone = (id: ZoneId, ids: readonly InstanceId[]): void => {
      if (ids.length === 0) return;
      const prev = this.lastZones.get(id);
      const reused = prev && sameIds(prev, ids) ? prev : [...ids];
      this.lastZones.set(id, reused);
      zones[id] = reused;
    };

    for (const id of state.zones.battlefield) {
      const inst = state.cards[id];
      if (inst) emit(inst);
    }
    for (const p of state.seating) {
      const bf = state.zones.battlefield.filter((id) => state.cards[id]?.controller === p);
      putZone(zoneId('bf', p), bf);

      // ⚠️ An opponent's hand keeps its real ids and its real LENGTH, with no
      // card data. That is what lets the table animate *that specific card back*
      // moving hand → battlefield, which is the difference between a board that
      // reads and one where cards teleport.
      const hand = state.zones.hand[p] ?? [];
      for (const id of hand) {
        const inst = state.cards[id];
        if (inst) emit(inst);
      }
      putZone(zoneId('hand', p), hand);
      if (p !== viewer) hiddenCounts[zoneId('hand', p)] = hand.length;

      for (const [kind, list] of [
        ['gy', state.zones.graveyard[p] ?? []],
        ['exile', state.zones.exile[p] ?? []],
        ['cmd', state.zones.command[p] ?? []],
      ] as const) {
        for (const id of list) {
          const inst = state.cards[id];
          if (inst) emit(inst);
        }
        putZone(zoneId(kind, p), list);
      }

      // ⚠️ NEVER the ids, never the order — for anyone, including the owner.
      hiddenCounts[zoneId('lib', p)] = (state.zones.library[p] ?? []).length;
    }

    // Cards on the stack, plus anything revealed to this viewer out of a hidden
    // zone (a peek). Revealed cards get real data but no zone entry, so nothing
    // renders them on the table — the client reads them off the event stream.
    const stackIds: InstanceId[] = [];
    for (const obj of state.stack) {
      if (!obj.card) continue;
      const inst = state.cards[obj.card];
      if (!inst) continue;
      emit(inst);
      stackIds.push(obj.card);
    }
    putZone('stack', stackIds);

    for (const inst of Object.values(state.cards)) {
      if (inst.zone.kind !== 'library') continue;
      if (!inst.revealedTo.includes(viewer)) continue;
      emit(inst);
    }

    const seats: Record<PlayerId, SeatView> = {};
    for (const p of state.seating) {
      const player = state.players[p];
      if (!player) continue;
      const next: SeatView = {
        playerId: p,
        name: player.name,
        life: player.life,
        cmdDamage: commanderDamageByPlayer(state, p),
        poison: player.poison,
        manaPool: player.pool as Record<ManaSymbol, number>,
        identity: player.identity as ColorLetter[],
        lost: player.hasLost,
      };
      const prev = this.lastSeats.get(p);
      const reused = prev && sameSeatView(prev, next) ? prev : next;
      this.lastSeats.set(p, reused);
      seats[p] = reused;
    }

    const stack: StackItemView[] = state.stack.map((obj) => ({
      stackItemId: obj.id,
      instanceId: obj.card,
      label: obj.label,
      controller: obj.controller,
      identity: [...obj.identity],
      targets: obj.targets.map((t) => ({ kind: t.kind, id: t.id })),
    }));

    // ⚠️ THIS IS WHERE THE LOG LEARNS WHO IS READING IT. `line.text` is the
    // canonical third person ("Ana draws a card."); rendering the parts again
    // against the viewer gives the viewer's own rows the second person ("You
    // draw a card."). The engine still knows nothing about "you" — projection is
    // per-viewer by definition, and each client's own projection is what makes
    // this correct in multiplayer and across the solo hotseat's seat changes.
    //
    // Cached by line id: a narration line is immutable once appended, so a
    // re-render is a map lookup rather than 200 string joins per commit, and the
    // reused `LogEntry` objects keep the D21 identity rule holding for the log.
    const log: LogEntry[] = state.narration.map((line) => {
      const seen = this.lastLog.get(line.id);
      if (seen) return seen;
      const entry: LogEntry = {
        id: line.id,
        text: render(line.parts, viewer),
        player: line.player,
        identity: [...line.identity],
        manual: line.manual,
      };
      this.lastLog.set(line.id, entry);
      return entry;
    });
    // The narration window is bounded, so the cache follows it rather than
    // growing for the length of the game.
    if (this.lastLog.size > state.narration.length * 2) {
      const live = new Set(state.narration.map((line) => line.id));
      for (const id of [...this.lastLog.keys()]) if (!live.has(id)) this.lastLog.delete(id);
    }

    // Drop cache entries for instances that no longer exist (tokens ceasing).
    for (const id of [...this.lastCards.keys()]) {
      if (!state.cards[id]) this.lastCards.delete(id);
    }

    return {
      ...base,
      me: viewer,
      seatOrder,
      seats,
      cards,
      zones,
      stack,
      turn: {
        active: state.turn.activePlayer,
        phase: STEP_TO_PHASE[state.turn.step],
        turnNumber: state.turn.turnNumber,
      },
      priority: state.priority.player,
      log,
      hiddenCounts,
    };
  }

  /**
   * The one predicate that decides what a player may see.
   *
   * Written as a single function on purpose: every "can they see it" question in
   * the app funnels through here, so the answer cannot differ between the card
   * map, the zone arrays and the event stream.
   */
  private canSee(inst: CardInstance): boolean {
    if (inst.revealedTo.includes(this.viewer)) return true;
    switch (inst.zone.kind) {
      case 'library':
        return false;
      case 'hand':
        return inst.zone.player === this.viewer;
      case 'exile':
        // A face-down exiled card is genuinely hidden; its controller sees it
        // through `revealedTo`, which is checked above.
        return !inst.faceDown;
      case 'battlefield':
        // A face-down permanent is a PUBLIC OBJECT with a hidden identity. Its
        // controller knows what it is; everyone else sees a 2/2.
        return !inst.faceDown || inst.controller === this.viewer;
      default:
        return true;
    }
  }
}

/**
 * Commander damage, keyed the way the view wants it.
 *
 * ⚠️ State keys commander damage by the COMMANDER'S INSTANCE ID (which is what
 * makes a partner pair track separately for the 21 threshold). The seat plate
 * shows one number per opponent, so this takes the MAXIMUM across that
 * opponent's commanders rather than the sum: the maximum is the number that
 * decides the game, and summing a partner pair would show 21 when neither half
 * has dealt lethal. See DECISIONS D35.
 */
function commanderDamageByPlayer(state: GameState, victim: PlayerId): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  const player = state.players[victim];
  if (!player) return out;
  for (const p of state.seating) out[p] = 0;
  for (const [commanderId, amount] of Object.entries(player.commanderDamage)) {
    const owner = state.cards[commanderId]?.owner;
    if (!owner) continue;
    out[owner] = Math.max(out[owner] ?? 0, amount);
  }
  return out;
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

/** Field by field, because a shallow object compare is exactly what fails here. */
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
    a.poison === b.poison &&
    a.lost === b.lost &&
    sameIds(a.identity, b.identity) &&
    sameCounters(a.cmdDamage as Record<string, number>, b.cmdDamage as Record<string, number>) &&
    sameCounters(
      a.manaPool as unknown as Record<string, number>,
      b.manaPool as unknown as Record<string, number>,
    )
  );
}

/** One-shot projection, for tests and for a fresh snapshot. No identity reuse. */
export function project(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  viewer: PlayerId,
): PlayerView {
  return new Projector(oracle, scripts, viewer).project(state);
}
