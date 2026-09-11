// `apply(state, event) → state`. The ONLY function that changes the game.
//
// ⚠️ PURE IN (state, event) ALONE. No oracle, no clock, no randomness, no
// lookups. That is the whole reason the events upstream look verbose: an event
// carries its OUTCOME, not an instruction to compute one. `LibraryShuffled`
// carries the resulting order; `CombatDamageDealt` carries the finished
// assignment; `Narrated` carries rendered text. Anything the reducer had to
// look up would be a chance for the replay and the live game to disagree, and
// the disagreement would surface 200 events later as "the fuzzer fails on seed
// 331" with no visible cause.
//
// ⚠️ TOTAL. Every event kind is handled and the switch is exhaustive (the
// `never` check at the bottom is a compile error if a kind is added without a
// case). An unhandled event that silently no-ops is the worst possible failure
// here: the live game would be right and the replay wrong.

import type { RngState } from './rng';
import { addToZone, removeFromZone } from './zones';
import type { CardMove, EventBody, GameEvent, ResolvedDamage } from './types/events';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import { EMPTY_POOL, addPool, subPool, type ManaPool, type RestrictedMana, type SpendRestriction } from './types/mana';

/**
 * D397 - one restricted bucket moved by `sign` times `mana`, keyed by the printed sentence.
 * A bucket that reaches empty is dropped, so the buckets a player holds are exactly the
 * restrictions their pool is under - and the state hash says so.
 */
function addRestricted(buckets: readonly RestrictedMana[], restriction: SpendRestriction, mana: ManaPool, sign = 1): readonly RestrictedMana[] {
  const delta: ManaPool = sign === 1 ? mana : { W: -mana.W, U: -mana.U, B: -mana.B, R: -mana.R, G: -mana.G, C: -mana.C };
  const at = buckets.findIndex((b) => b.restriction.text === restriction.text);
  const merged = addPool(at >= 0 ? (buckets[at]?.mana ?? EMPTY_POOL) : EMPTY_POOL, delta);
  const empty = merged.W === 0 && merged.U === 0 && merged.B === 0 && merged.R === 0 && merged.G === 0 && merged.C === 0;
  if (at < 0) return empty ? buckets : [...buckets, { restriction, mana: merged }];
  if (empty) return buckets.filter((_, i) => i !== at);
  return buckets.map((b, i) => (i === at ? { restriction: b.restriction, mana: merged } : b));
}
import {
  DEFAULT_STOPS,
  type CardInstance,
  type CombatState,
  type GameState,
  type NarrationLine,
  type PlayerState,
  type PreventionShield,
  type StackObject,
  type TurnMemory,
  type TurnState,
  type Zones,
} from './types/state';

const MAX_NARRATION = 200;

/**
 * Fold one event into the state.
 *
 * `eventCount` advances here and nowhere else, which is what makes it a usable
 * cache key for `derive` and a usable staleness guard for a payment plan.
 */
export function apply(state: GameState, event: GameEvent): GameState {
  const next = applyBody(state, event.body);
  return {
    ...next,
    eventCount: state.eventCount + 1,
    stepId: event.stepId,
    // ⚠️ The RNG advances ONLY through a recorded rngAfter. A replay that
    // re-ran the generator would drift the moment an event was added or
    // reordered; taking the recorded state makes replay exact by construction.
    rng: event.rngAfter ?? next.rng,
  };
}

function withPlayer(state: GameState, id: PlayerId, patch: Partial<PlayerState>): GameState {
  const player = state.players[id];
  if (!player) return state;
  return { ...state, players: { ...state.players, [id]: { ...player, ...patch } } };
}

/**
 * D328 - CR 602.5b "activate only once each turn": count the activation on
 * the turn, keyed by the source permanent and the ability it activated. A
 * spell, a triggered ability or an ability with no source is not counted.
 */
function recordActivation(turn: TurnState, obj: StackObject): TurnState {
  if (obj.kind !== 'activated' || obj.source === null || obj.abilityRef === null) return turn;
  const key = `${obj.source}|${obj.abilityRef}`;
  return { ...turn, activations: { ...turn.activations, [key]: (turn.activations[key] ?? 0) + 1 } };
}

/** D348 - the empty record a turn starts with. */
export const EMPTY_TURN_MEMORY: TurnMemory = {
  cast: {},
  died: [],
  entered: {},
  leftGraveyard: {},
  discarded: {},
  tokensCreated: {},
  lostLife: {},
  gainedLife: {},
  attackers: 0,
  left: [],
  damaged: {},
  lifeGained: {},
  lifeLost: {},
  toGraveyard: {},
};

/**
 * D398 - what damage does to the turn record. Damage dealt to a player is remembered
 * as DAMAGE (Bloodthirst), and - because `applyDamage` moves the life total itself
 * with no `LifeChanged` event - as LIFE LOST too (CR 120.3a), unless infect turned it
 * into poison (CR 702.90b); lifelink is life GAINED (CR 702.15b). Until D398 the D348
 * record saw life move only through `LifeChanged`, so "an opponent lost life this
 * turn" was false after every unblocked attack.
 */
function recordDamage(memory: TurnMemory, damages: readonly ResolvedDamage[]): TurnMemory {
  let m = memory;
  for (const d of damages) {
    if (d.amount <= 0) continue;
    if (d.target.kind === 'player') {
      const id = d.target.id;
      m = { ...m, damaged: { ...m.damaged, [id]: (m.damaged[id] ?? 0) + d.amount } };
      if (d.applyAs !== 'poison') {
        m = { ...m, lostLife: { ...m.lostLife, [id]: true }, lifeLost: { ...m.lifeLost, [id]: (m.lifeLost[id] ?? 0) + d.amount } };
      }
    }
    if (d.lifelinkTo) {
      const to = d.lifelinkTo;
      m = { ...m, gainedLife: { ...m.gainedLife, [to]: true }, lifeGained: { ...m.lifeGained, [to]: (m.lifeGained[to] ?? 0) + d.amount } };
    }
  }
  return m;
}

/**
 * D348 - what a batch of moves adds to the turn record: what died, what entered,
 * what left a graveyard, what was discarded. ZONES ONLY - this file has no oracle,
 * so the types are the checking side's question.
 */
function recordMoves(memory: TurnMemory, moves: readonly CardMove[], before: Readonly<Record<InstanceId, CardInstance>>): TurnMemory {
  let died = memory.died;
  let entered = memory.entered;
  let leftGraveyard = memory.leftGraveyard;
  let discarded = memory.discarded;
  let left = memory.left;
  let toGraveyard = memory.toGraveyard;
  for (const move of moves) {
    if (move.from.kind === 'battlefield' && move.to.kind === 'graveyard') {
      // ⚠️ The controller it had WHEN it died (CR 608.2h, last known information):
      // read off the instance BEFORE the batch applies, not after it lands.
      const controller = before[move.card]?.controller ?? move.from.player;
      if (controller !== null && controller !== undefined) died = [...died, { card: move.card, controller }];
    }
    // D398 - ANY exit from the battlefield, with the controller it had then (revolt reads this).
    if (move.from.kind === 'battlefield' && move.to.kind !== 'battlefield') {
      const controller = before[move.card]?.controller ?? move.from.player;
      if (controller !== null && controller !== undefined) left = [...left, { card: move.card, controller }];
    }
    if (move.to.kind === 'battlefield' && move.from.kind !== 'battlefield') {
      const who = move.to.player ?? before[move.card]?.owner ?? null;
      if (who !== null) entered = { ...entered, [who]: [...(entered[who] ?? []), move.card] };
    }
    if (move.from.kind === 'graveyard' && move.to.kind !== 'graveyard') {
      const who = move.from.player;
      if (who !== null) leftGraveyard = { ...leftGraveyard, [who]: (leftGraveyard[who] ?? 0) + 1 };
    }
    if (move.from.kind === 'hand' && move.to.kind === 'graveyard') {
      const who = move.from.player;
      if (who !== null) discarded = { ...discarded, [who]: (discarded[who] ?? 0) + 1 };
    }
    // D398 - a card put into a graveyard from ANYWHERE (descend), on the graveyard owner's slot.
    if (move.to.kind === 'graveyard' && move.from.kind !== 'graveyard') {
      const who = move.to.player ?? before[move.card]?.owner ?? null;
      if (who !== null) toGraveyard = { ...toGraveyard, [who]: [...(toGraveyard[who] ?? []), move.card] };
    }
  }
  return { ...memory, died, entered, leftGraveyard, discarded, left, toGraveyard };
}

/** D336 - the turn memory: a SPELL cast counts on its controller's tally; an ability put on the stack does not. */
function recordSpell(turn: TurnState, body: EventBody): TurnState {
  if (body.t !== 'SpellCast') return turn;
  const who = body.obj.controller;
  return {
    ...turn,
    spellsCast: { ...turn.spellsCast, [who]: (turn.spellsCast[who] ?? 0) + 1 },
    // D348 - the card itself, so the check can ask what kind of spell it was.
    memory:
      body.obj.card === null
        ? turn.memory
        : { ...turn.memory, cast: { ...turn.memory.cast, [who]: [...(turn.memory.cast[who] ?? []), body.obj.card] } },
  };
}

function withCard(state: GameState, id: InstanceId, patch: Partial<CardInstance>): GameState {
  const card = state.cards[id];
  if (!card) return state;
  return { ...state, cards: { ...state.cards, [id]: { ...card, ...patch } } };
}

function withCards(state: GameState, cards: Record<InstanceId, CardInstance>): GameState {
  return { ...state, cards };
}

/**
 * Mark damage on permanents and players.
 *
 * ⚠️ ONE implementation, shared by `CombatDamageDealt` and `DamageDealt`.
 * Infect, wither, deathtouch, lifelink and poison are subtle enough that two
 * copies would drift, and the drift would show up as a Lightning Bolt that gives
 * a creature a −1/−1 counter in combat and a damage mark out of it.
 */
function applyDamage(state: GameState, damages: readonly ResolvedDamage[]): GameState {
  const cards = { ...state.cards };
  const players = { ...state.players };
  for (const d of damages) {
    if (d.target.kind === 'card') {
      const card = cards[d.target.id];
      if (card) {
        // ⚠️ CR 702.90a / 702.79a. Infect and wither REPLACE the damage mark
        // with −1/−1 counters. The difference is not cosmetic: a damage mark
        // is wiped at cleanup, a counter is permanent, and deathtouch still
        // applies on top of either.
        cards[d.target.id] =
          d.applyAs === 'wither'
            ? {
                ...card,
                counters: {
                  ...card.counters,
                  '-1/-1': (card.counters['-1/-1'] ?? 0) + d.amount,
                },
                deathtouchDamage: card.deathtouchDamage || (d.deathtouch && d.amount > 0),
              }
            : {
                ...card,
                damage: card.damage + d.amount,
                deathtouchDamage: card.deathtouchDamage || (d.deathtouch && d.amount > 0),
              };
      }
    } else {
      const p = players[d.target.id];
      if (p) {
        // ⚠️ Infect gives poison INSTEAD of life loss (CR 702.90b); toxic
        // gives poison IN ADDITION to it (CR 702.180a). Both land here so
        // that one event carries the whole outcome and `apply` stays pure in
        // (state, event) alone — a second event would let a replay interleave
        // them differently from the live game.
        const poison = d.applyAs === 'poison' ? d.amount : d.toxic;
        players[d.target.id] = {
          ...p,
          life: d.applyAs === 'poison' ? p.life : p.life - d.amount,
          poison: p.poison + poison,
        };
      }
    }
    if (d.lifelinkTo) {
      // ⚠️ Lifelink pays out even when the damage became counters. CR 702.90b:
      // life gain keys off the damage being DEALT, not off how it was applied.
      const gainer = players[d.lifelinkTo];
      if (gainer) players[d.lifelinkTo] = { ...gainer, life: gainer.life + d.amount };
    }
  }
  return { ...state, cards, players };
}

function narrate(state: GameState, line: Omit<NarrationLine, 'id'>): GameState {
  const id = state.counters.logLine + 1;
  const narration = [...state.narration, { id, ...line }].slice(-MAX_NARRATION);
  return { ...state, narration, counters: { ...state.counters, logLine: id } };
}

/**
 * Fields that exist only while the object is on the battlefield. CR 400.7: a
 * card that changes zones becomes a NEW object with no memory of the old one.
 *
 * ⚠️ `commanderCastCount` and `isCommander` deliberately survive — CR 903.8
 * says the tax counts casts from the command zone across the whole game, and a
 * commander that bounces to the command zone and back is still a commander.
 * Those two are the entire exception, and forgetting them makes the second cast
 * of a commander cost {0}.
 */
function clearBattlefieldFields(owner: PlayerId): Partial<CardInstance> {
  return {
    tapped: false,
    damage: 0,
    deathtouchDamage: false,
    counters: {},
    attachedTo: null,
    attachments: [],
    summonedOnTurn: null,
    phasedOut: false,
    renowned: false,
    controller: owner,
    ptOverride: null,
    typeOverride: null,
    chosenColor: null,
    faceIndex: 0,
  };
}

/**
 * Detach `id` from whatever it is attached to, and detach everything attached
 * to it. Runs on every zone change out of the battlefield.
 *
 * ⚠️ Both directions. Clearing only `attachedTo` leaves the host's
 * `attachments` array holding a dead id, and the aura-falls SBA then fires on a
 * permanent that no longer exists — a crash that only shows up several turns
 * later.
 */
function detachAll(cards: Record<InstanceId, CardInstance>, id: InstanceId): void {
  const self = cards[id];
  if (!self) return;
  if (self.attachedTo) {
    const host = cards[self.attachedTo];
    if (host) {
      cards[host.id] = { ...host, attachments: host.attachments.filter((x) => x !== id) };
    }
  }
  for (const attachedId of self.attachments) {
    const attached = cards[attachedId];
    if (attached) cards[attachedId] = { ...attached, attachedTo: null };
  }
}

function applyBody(state: GameState, body: EventBody): GameState {
  switch (body.t) {
    // ── lifecycle ────────────────────────────────────────────────────────
    case 'GameCreated': {
      const players: Record<PlayerId, PlayerState> = {};
      const zones: Zones = {
        library: {},
        hand: {},
        battlefield: [],
        graveyard: {},
        exile: {},
        command: {},
      };
      const library: Record<string, readonly InstanceId[]> = {};
      const hand: Record<string, readonly InstanceId[]> = {};
      const graveyard: Record<string, readonly InstanceId[]> = {};
      const exile: Record<string, readonly InstanceId[]> = {};
      const command: Record<string, readonly InstanceId[]> = {};
      for (const p of body.players) {
        players[p.id] = {
          id: p.id,
          name: p.name,
          seat: p.seat,
          life: body.options.startingLife,
          poison: 0,
          pool: EMPTY_POOL,
          poolSnow: EMPTY_POOL,
          poolRestricted: [],
          commanderDamage: {},
          commanderIds: [],
          landsPlayedThisTurn: 0,
          maxLandsPerTurn: body.options.maxLandsPerTurn,
          hasLost: false,
          lossReason: null,
          drewFromEmptyLibrary: false,
          mulligan: { taken: 0, kept: false, toBottom: 0 },
          stops: state.players[p.id]?.stops ?? DEFAULT_STOPS,
          connected: true,
          identity: [],
          commanderZoneAlways: null,
        };
        library[p.id] = [];
        hand[p.id] = [];
        graveyard[p.id] = [];
        exile[p.id] = [];
        command[p.id] = [];
      }
      const first = body.seating[0] ?? '';
      return {
        ...state,
        gameId: body.gameId,
        options: body.options,
        seating: body.seating,
        players,
        cards: {},
        zones: { ...zones, library, hand, graveyard, exile, command },
        stack: [],
        turn: {
          turnNumber: 0,
          activePlayer: first,
          phase: 'beginning',
          step: 'untap',
          turnBasedActionsDone: false,
          cleanupNeedsRepeat: false,
          activations: {},
          spellsCast: {},
          cardsDrawn: {},
          attacked: false,
          memory: EMPTY_TURN_MEMORY,
        },
        priority: {
          player: null,
          passedSinceLastAction: [],
          stackAdds: 0,
          seenStackAdds: {},
          awaiting: null,
          holdingPriority: null,
        },
        combat: null,
        pendingCast: null,
        pendingTriggers: [],
        winners: [],
        gamePhase: 'lobby',
      };
    }

    case 'DeckLoaded': {
      const cards = { ...state.cards };
      const libraryIds: InstanceId[] = [];
      const commandIds: InstanceId[] = [];
      for (const c of body.cards) {
        cards[c.id] = newInstance(c.id, c.oracleId, c.printingId, body.player, {
          kind: 'library',
          player: body.player,
        });
        libraryIds.push(c.id);
      }
      for (const c of body.commanders) {
        cards[c.id] = newInstance(c.id, c.oracleId, c.printingId, body.player, {
          kind: 'command',
          player: body.player,
        }, true);
        commandIds.push(c.id);
      }
      const allIds = [...body.cards, ...body.commanders].map((c) => Number(c.id.slice(1)) || 0);
      const withCounters = {
        ...state,
        cards,
        counters: {
          ...state.counters,
          instance: Math.max(state.counters.instance, 0, ...allIds),
        },
        zones: {
          ...state.zones,
          library: { ...state.zones.library, [body.player]: libraryIds },
          command: { ...state.zones.command, [body.player]: commandIds },
        },
      };
      return withPlayer(withCounters, body.player, {
        commanderIds: commandIds,
        identity: body.identity,
      });
    }

    case 'LibraryShuffled':
      return {
        ...state,
        zones: { ...state.zones, library: { ...state.zones.library, [body.player]: body.order } },
      };

    case 'GameStarted':
      return {
        ...state,
        turn: { ...state.turn, activePlayer: body.startingPlayer, turnNumber: 0 },
      };

    case 'GamePhaseChanged':
      return { ...state, gamePhase: body.phase };

    case 'GameEnded':
      return { ...state, gamePhase: 'finished', winners: body.winners, priority: { ...state.priority, player: null, awaiting: null } };

    // ── mulligan ─────────────────────────────────────────────────────────
    case 'MulliganTaken': {
      const p = state.players[body.player];
      if (!p) return state;
      return withPlayer(state, body.player, { mulligan: { ...p.mulligan, taken: body.taken } });
    }

    case 'MulliganKept': {
      const p = state.players[body.player];
      if (!p) return state;
      return withPlayer(state, body.player, {
        mulligan: { ...p.mulligan, kept: true, toBottom: body.toBottom },
      });
    }

    case 'MulliganBottomed': {
      const p = state.players[body.player];
      if (!p) return state;
      return withPlayer(state, body.player, { mulligan: { ...p.mulligan, toBottom: 0 } });
    }

    // ── zones ────────────────────────────────────────────────────────────
    case 'CardsMoved': {
      let zones = state.zones;
      const cards = { ...state.cards };
      for (const move of body.moves) {
        const card = cards[move.card];
        if (!card) continue;
        zones = removeFromZone(zones, move.from, move.card);
        if (move.from.kind === 'battlefield' && move.to.kind !== 'battlefield') {
          detachAll(cards, move.card);
        }
        const entering = move.to.kind === 'battlefield' && move.from.kind !== 'battlefield';
        const staying = move.to.kind === 'battlefield' && move.from.kind === 'battlefield';
        const base: Partial<CardInstance> = staying
          ? {}
          : {
              ...clearBattlefieldFields(card.owner),
              // ⚠️ For the battlefield, `ZoneRef.player` names the CONTROLLER —
              // the array itself is shared and ordered. Without this, a stolen
              // or flickered permanent would silently return to its owner.
              ...(entering
                ? {
                    controller: move.to.player ?? card.owner,
                    summonedOnTurn: state.turn.turnNumber,
                  }
                : {}),
            };
        cards[move.card] = {
          ...(cards[move.card] as CardInstance),
          ...base,
          zone: move.to,
          faceDown: move.faceDown ?? false,
          // ⚠️ AFTER `base`, which carries `clearBattlefieldFields`'s reset to 0.
          // Absent — every ordinary card — this changes nothing at all. See D155.
          ...(move.faceIndex === undefined ? {} : { faceIndex: move.faceIndex }),
          // A reveal is about a card sitting in a hidden zone. Once it moves,
          // the reveal is meaningless and keeping it would leak the new zone.
          revealedTo: [],
        };
        zones = addToZone(zones, move.to, move.card, move.placement ?? 'top');
      }
      // D330 - a shield belongs to the permanent on the battlefield; leaving takes it.
      let regenerationShields = state.regenerationShields;
      for (const move of body.moves) {
        if (move.from.kind === 'battlefield' && move.to.kind !== 'battlefield' && regenerationShields[move.card] !== undefined) {
          regenerationShields = Object.fromEntries(Object.entries(regenerationShields).filter(([k]) => k !== move.card));
        }
      }
      // D348 - the turn record, read off the instances BEFORE this batch applied.
      return { ...state, zones, cards, regenerationShields, turn: { ...state.turn, memory: recordMoves(state.turn.memory, body.moves, state.cards) } };
    }

    case 'TokenCreated': {
      const cards = { ...state.cards };
      cards[body.card] = {
        ...newInstance(body.card, body.oracleId, body.printingId, body.owner, {
          kind: 'battlefield',
          player: null,
        }),
        controller: body.controller,
        isToken: true,
        summonedOnTurn: body.turnNumber,
      };
      return {
        ...state,
        cards,
        zones: addToZone(state.zones, { kind: 'battlefield', player: null }, body.card),
        // D348 - the turn remembers the token, and that it entered under its controller.
        turn: {
          ...state.turn,
          memory: {
            ...state.turn.memory,
            tokensCreated: { ...state.turn.memory.tokensCreated, [body.controller]: (state.turn.memory.tokensCreated[body.controller] ?? 0) + 1 },
            entered: { ...state.turn.memory.entered, [body.controller]: [...(state.turn.memory.entered[body.controller] ?? []), body.card] },
          },
        },
        counters: {
          ...state.counters,
          instance: Math.max(state.counters.instance, Number(body.card.slice(1)) || 0),
        },
      };
    }

    case 'TokensCeased': {
      const cards = { ...state.cards };
      let zones = state.zones;
      for (const id of body.cards) {
        const card = cards[id];
        if (!card) continue;
        detachAll(cards, id);
        zones = removeFromZone(zones, card.zone, id);
        delete cards[id];
      }
      // ⚠️ COMBAT MAY STILL NAME A CEASED TOKEN, and a deleted instance is the
      // one departure the "filter at use" convention cannot absorb — every
      // other dead combatant still EXISTS in a graveyard, which is all
      // `checkInvariants` requires. Reachable since D168: a chooser cost can
      // sacrifice an attacking token at instant speed while an awaiting holds
      // the pump mid-combat, where end-of-combat's `RemovedFromCombat` has not
      // run yet. Pruned in that event's exact shape (attackers, blockers, and
      // both nested orders).
      const combat =
        state.combat === null
          ? null
          : {
              ...state.combat,
              attackers: state.combat.attackers
                .filter((a) => !body.cards.includes(a.card))
                .map((a) => ({ ...a, blockerOrder: a.blockerOrder.filter((x) => !body.cards.includes(x)) })),
              blockers: state.combat.blockers
                .filter((b) => !body.cards.includes(b.card))
                .map((b) => ({ ...b, attackerOrder: b.attackerOrder.filter((x) => !body.cards.includes(x)) })),
            };
      return { ...state, cards, zones, combat };
    }

    case 'CardsRevealed': {
      const cards = { ...state.cards };
      for (const id of body.cards) {
        const card = cards[id];
        if (!card) continue;
        const to = [...new Set([...card.revealedTo, ...body.to])];
        cards[id] = { ...card, revealedTo: to };
      }
      return withCards(state, cards);
    }

    case 'RevealCleared': {
      const cards = { ...state.cards };
      for (const id of body.cards) {
        const card = cards[id];
        if (!card) continue;
        cards[id] = { ...card, revealedTo: [] };
      }
      return withCards(state, cards);
    }

    case 'PermanentsTapped':
    case 'PermanentsUntapped': {
      const tapped = body.t === 'PermanentsTapped';
      const cards = { ...state.cards };
      for (const id of body.cards) {
        const card = cards[id];
        if (!card) continue;
        // ⚠️ Tapped is a BATTLEFIELD-ONLY property (CR 110.5b). The Tier-3 tap
        // tool is deliberately permissive about what you point it at, and the
        // fuzzer duly pointed it at a card in hand — leaving a tapped card in a
        // hand, which every downstream invariant then reports as corruption.
        // Ignoring it here keeps the tool forgiving and the state coherent.
        if (card.zone.kind !== 'battlefield') continue;
        cards[id] = { ...card, tapped };
      }
      return withCards(state, cards);
    }

    case 'CountersChanged': {
      const cards = { ...state.cards };
      for (const change of body.changes) {
        const card = cards[change.card];
        if (!card) continue;
        const counters = { ...card.counters };
        const next = (counters[change.kind] ?? 0) + change.delta;
        if (next <= 0) delete counters[change.kind];
        else counters[change.kind] = next;
        cards[change.card] = { ...card, counters };
      }
      return withCards(state, cards);
    }

    case 'DamageCleared': {
      const cards = { ...state.cards };
      for (const id of body.cards) {
        const card = cards[id];
        if (!card) continue;
        cards[id] = { ...card, damage: 0, deathtouchDamage: false };
      }
      return withCards(state, cards);
    }

    case 'AttachmentChanged': {
      const cards = { ...state.cards };
      detachAll(cards, body.card);
      const self = cards[body.card];
      if (!self) return withCards(state, cards);
      cards[body.card] = { ...self, attachedTo: body.to, attachments: [] };
      if (body.to) {
        const host = cards[body.to];
        if (host) cards[body.to] = { ...host, attachments: [...host.attachments, body.card] };
      }
      return withCards(state, cards);
    }

    case 'FaceDownSet':
      return withCard(state, body.card, { faceDown: body.faceDown });

    case 'FaceIndexSet':
      return withCard(state, body.card, { faceIndex: body.faceIndex });

    case 'ControlChanged':
      return withCard(state, body.card, { controller: body.controller });

    case 'PtOverrideSet':
      return withCard(state, body.card, { ptOverride: body.override });

    case 'TypeOverrideSet':
      return withCard(state, body.card, { typeOverride: body.typeLine });

    case 'CommanderFlagSet': {
      const card = state.cards[body.card];
      if (!card) return state;
      const owner = state.players[card.owner];
      const next = withCard(state, body.card, { isCommander: body.isCommander });
      if (!owner) return next;
      const ids = body.isCommander
        ? [...new Set([...owner.commanderIds, body.card])]
        : owner.commanderIds.filter((x) => x !== body.card);
      return withPlayer(next, card.owner, { commanderIds: ids });
    }

    // ── players ──────────────────────────────────────────────────────────
    case 'LifeChanged': {
      // D348 - the turn remembers that this player lost or gained life.
      // D398 - and HOW MUCH, beside whether ("if you gained 3 or more life this turn").
      const m = state.turn.memory;
      const memory =
        body.delta < 0
          ? { ...m, lostLife: { ...m.lostLife, [body.player]: true }, lifeLost: { ...m.lifeLost, [body.player]: (m.lifeLost[body.player] ?? 0) - body.delta } }
          : body.delta > 0
            ? { ...m, gainedLife: { ...m.gainedLife, [body.player]: true }, lifeGained: { ...m.lifeGained, [body.player]: (m.lifeGained[body.player] ?? 0) + body.delta } }
            : m;
      return withPlayer({ ...state, turn: { ...state.turn, memory } }, body.player, { life: body.to });
    }

    case 'PoisonChanged':
      return withPlayer(state, body.player, { poison: body.to });

    case 'MonarchChanged':
      return { ...state, monarch: body.player };

    case 'ManaAdded': {
      const p = state.players[body.player];
      if (!p) return state;
      // D364 - snow mana lands in BOTH pools; the sub-pool is what `{S}` can spend.
      // D397 - restricted mana lands in its bucket too, one per printed sentence.
      return withPlayer(state, body.player, {
        pool: addPool(p.pool, body.mana),
        poolSnow: body.snow ? addPool(p.poolSnow, body.mana) : p.poolSnow,
        poolRestricted: body.only ? addRestricted(p.poolRestricted, body.only, body.mana) : p.poolRestricted,
      });
    }

    case 'ManaSpent': {
      const p = state.players[body.player];
      if (!p) return state;
      // D364 - the payment says how much of what it spent was snow mana; the
      // sub-pool cannot be inferred here, because which mana paid which symbol
      // is the PLAN's decision and this reducer has no plan.
      // D397 - the same for the restricted buckets: the payment names each one it drew on.
      let poolRestricted = p.poolRestricted;
      for (const r of body.restricted) poolRestricted = addRestricted(poolRestricted, r.restriction, r.mana, -1);
      return withPlayer(state, body.player, {
        pool: subPool(p.pool, body.mana),
        poolSnow: subPool(p.poolSnow, body.snow),
        poolRestricted,
      });
    }

    case 'ManaPoolEmptied':
      return withPlayer(state, body.player, { pool: EMPTY_POOL, poolSnow: EMPTY_POOL, poolRestricted: [] });

    case 'CommanderDamageDealt': {
      const p = state.players[body.player];
      if (!p) return state;
      return withPlayer(state, body.player, {
        commanderDamage: { ...p.commanderDamage, [body.from]: body.total },
      });
    }

    case 'PlayerLost':
      return withPlayer(state, body.player, { hasLost: true, lossReason: body.reason });

    case 'DrewFromEmptyLibrary':
      return withPlayer(state, body.player, { drewFromEmptyLibrary: true });

    case 'LandPlayed':
      return withPlayer(state, body.player, { landsPlayedThisTurn: body.playedThisTurn });

    case 'StopsChanged':
      return withPlayer(state, body.player, { stops: body.stops });

    case 'PresenceChanged':
      return withPlayer(state, body.player, { connected: body.connected });

    case 'CommanderZoneAlwaysSet':
      return withPlayer(state, body.player, { commanderZoneAlways: body.value });

    // ── turn / priority ──────────────────────────────────────────────────
    case 'TurnBegan': {
      const players = { ...state.players };
      for (const id of state.seating) {
        const p = players[id];
        if (!p) continue;
        players[id] = {
          ...p,
          landsPlayedThisTurn: id === body.activePlayer ? 0 : p.landsPlayedThisTurn,
          stops: p.stops.fullControlThisTurn ? { ...p.stops, fullControlThisTurn: false } : p.stops,
        };
      }
      return {
        ...state,
        players,
        turn: {
          turnNumber: body.turnNumber,
          activePlayer: body.activePlayer,
          phase: 'beginning',
          step: 'untap',
          turnBasedActionsDone: false,
          cleanupNeedsRepeat: false,
          activations: {},
          spellsCast: {},
          cardsDrawn: {},
          attacked: false,
          memory: EMPTY_TURN_MEMORY,
        },
        priority: { ...state.priority, passedSinceLastAction: [], player: null },
      };
    }

    case 'StepBegan':
      return {
        ...state,
        turn: { ...state.turn, phase: body.phase, step: body.step, turnBasedActionsDone: false },
        priority: { ...state.priority, passedSinceLastAction: [], player: null },
      };

    case 'StepEnded':
      return { ...state, priority: { ...state.priority, passedSinceLastAction: [], player: null } };

    case 'TurnBasedActionsDone':
      return { ...state, turn: { ...state.turn, turnBasedActionsDone: true } };

    case 'CleanupRepeatSet':
      return { ...state, turn: { ...state.turn, cleanupNeedsRepeat: body.value } };

    case 'PriorityGranted':
      return { ...state, priority: { ...state.priority, player: body.player } };

    case 'PriorityPassed':
      return {
        ...state,
        priority: {
          ...state.priority,
          player: null,
          passedSinceLastAction: state.priority.passedSinceLastAction.includes(body.player)
            ? state.priority.passedSinceLastAction
            : [...state.priority.passedSinceLastAction, body.player],
          // Declining to respond means you have seen everything now on the
          // stack; the next thing ADDED is what should stop you again.
          seenStackAdds: { ...state.priority.seenStackAdds, [body.player]: state.priority.stackAdds },
          // Passing is how you let go of a held priority.
          holdingPriority:
            state.priority.holdingPriority === body.player ? null : state.priority.holdingPriority,
        },
      };

    case 'PriorityReset':
      return { ...state, priority: { ...state.priority, passedSinceLastAction: [] } };

    case 'HoldPrioritySet':
      return { ...state, priority: { ...state.priority, holdingPriority: body.player } };

    case 'AwaitingSet':
      return { ...state, priority: { ...state.priority, awaiting: body.awaiting } };

    case 'StateBasedActionsApplied':
      // A marker for the log and the animation stream; the consequences travel
      // as their own events in the same batch.
      return state;

    // ── stack / casting ──────────────────────────────────────────────────
    case 'CastBegan':
      return {
        ...state,
        pendingCast: body.pending,
        counters: {
          ...state.counters,
          stack: Math.max(state.counters.stack, Number(body.pending.stackId.slice(1)) || 0),
        },
      };

    case 'CastStageSet':
      return state.pendingCast ? { ...state, pendingCast: { ...state.pendingCast, stage: body.stage } } : state;

    case 'TargetsChosen':
      return state.pendingCast
        ? { ...state, pendingCast: { ...state.pendingCast, targets: body.targets } }
        : state;

    case 'XChosen':
      return state.pendingCast
        ? { ...state, pendingCast: { ...state.pendingCast, xValue: body.x, problem: body.problem } }
        : state;

    case 'ModesChosen':
      return state.pendingCast ? { ...state, pendingCast: { ...state.pendingCast, modes: body.modes } } : state;

    case 'CastCancelled':
      return { ...state, pendingCast: null };

    // ⚠️ Targets only, and only on an object that is already there. It does NOT
    // touch `stackAdds` or `passedSinceLastAction`: nothing new arrived on the
    // stack, so re-arming everyone's "somebody cast something" stop would make
    // one trigger stop the table twice.
    case 'ReplacementPending':
      return { ...state, pendingReplacement: body.pending };

    case 'ReplacementResolved':
      return { ...state, pendingReplacement: null };

    case 'AsksQueued':
      return { ...state, pendingAsks: body.pending };

    case 'AsksResolved':
      return { ...state, pendingAsks: null };

    // D391 - a marker; the CountersChanged and PoisonChanged that follow it do the work.
    case 'Proliferated':
      return state;

    // D396 - a bite's or a fight's marker: the damage beside it moves the state, this does not.
    case 'Fought':
      return state;

    case 'ColorChosen':
      return withCard(state, body.card, { chosenColor: body.color });

    case 'StackTargetsSet':
      return {
        ...state,
        stack: state.stack.map((o) => (o.id === body.stackId ? { ...o, targets: body.targets } : o)),
      };

    case 'StackModesSet':
      return {
        ...state,
        stack: state.stack.map((o) => (o.id === body.stackId ? { ...o, modes: body.modes } : o)),
      };

    case 'SpellCast':
    case 'AbilityPutOnStack': {
      const stackAdds = state.priority.stackAdds + 1;
      return {
        ...state,
        stack: [...state.stack, body.obj],
        pendingCast: null,
        turn: recordSpell(recordActivation(state.turn, body.obj), body),
        priority: {
          ...state.priority,
          passedSinceLastAction: [],
          stackAdds,
          // ⚠️ The controller has already seen their OWN spell, so
          // `stopWhenAnyoneCasts` does not stop them to respond to themselves.
          seenStackAdds: { ...state.priority.seenStackAdds, [body.obj.controller]: stackAdds },
        },
        counters: {
          ...state.counters,
          stack: Math.max(state.counters.stack, Number(body.obj.id.slice(1)) || 0),
        },
      };
    }

    case 'CommanderCastCountIncreased':
      return withCard(state, body.card, { commanderCastCount: body.to });

    case 'StackResolved':
    case 'SpellFizzled':
    case 'SpellCountered':
      // The card's movement travels as its own CardsMoved in the same batch.
      return {
        ...state,
        stack: state.stack.filter((s) => s.id !== body.stackId),
        priority: { ...state.priority, passedSinceLastAction: [] },
      };

    case 'PendingTriggersAdded':
      return { ...state, pendingTriggers: [...state.pendingTriggers, ...body.triggers] };

    case 'PendingTriggersCleared':
      return { ...state, pendingTriggers: state.pendingTriggers.filter((t) => !body.ids.includes(t.id)) };

    case 'OptionalTriggerAnswered':
    case 'EntersChoiceAnswered':
    case 'PaymentAnswered':
      // A marker for the log and the animation stream, like
      // `StateBasedActionsApplied`; what the answer DID travels as its own
      // events in the same batch.
      return state;

    case 'DrewCards':
      // A marker too: `DrewCards` marks a REAL draw beside its `CardsMoved`
      // (the trigger bus's discriminator, D189). D336 - and the turn memory
      // counts the cards it names ("your second card each turn").
      return {
        ...state,
        turn: { ...state.turn, cardsDrawn: { ...state.turn.cardsDrawn, [body.player]: (state.turn.cardsDrawn[body.player] ?? 0) + body.cards.length } },
      };

    // ── combat ───────────────────────────────────────────────────────────
    case 'CombatBegan':
      return { ...state, combat: { attackers: [], blockers: [], hasFirstStrikeSubstep: false } };

    case 'AttackersDeclared':
      return {
        ...state,
        // D340 - Raid: the turn remembers that the active player attacked.
        // D348 - and how many attacked, for "if you attacked with two or more creatures this turn".
        turn:
          body.attackers.length > 0
            ? { ...state.turn, attacked: true, memory: { ...state.turn.memory, attackers: state.turn.memory.attackers + body.attackers.length } }
            : state.turn,
        combat: {
          attackers: body.attackers.map((a) => ({
            card: a.card,
            defender: a.defender,
            becameBlocked: false,
            blockerOrder: [],
            dealtFirstStrikeDamage: false,
          })),
          blockers: [],
          hasFirstStrikeSubstep: false,
        },
      };

    case 'BlockersDeclared': {
      if (!state.combat) return state;
      const byBlocker = new Map<InstanceId, InstanceId[]>();
      const byAttacker = new Map<InstanceId, InstanceId[]>();
      for (const b of body.blocks) {
        byBlocker.set(b.blocker, [...(byBlocker.get(b.blocker) ?? []), b.attacker]);
        byAttacker.set(b.attacker, [...(byAttacker.get(b.attacker) ?? []), b.blocker]);
      }
      const attackers = state.combat.attackers.map((a) => {
        const blockers = byAttacker.get(a.card) ?? [];
        return blockers.length > 0 ? { ...a, blockerOrder: blockers } : a;
      });
      const blockers = [...byBlocker.entries()].map(([card, atk]) => ({
        card,
        attackerOrder: atk,
        dealtFirstStrikeDamage: false,
      }));
      return { ...state, combat: { ...state.combat, attackers, blockers } };
    }

    case 'AttackerBecameBlocked': {
      if (!state.combat) return state;
      return {
        ...state,
        combat: {
          ...state.combat,
          attackers: state.combat.attackers.map((a) =>
            body.attackers.includes(a.card) ? { ...a, becameBlocked: true } : a,
          ),
        },
      };
    }

    case 'BlockerOrderSet': {
      if (!state.combat) return state;
      return {
        ...state,
        combat: {
          ...state.combat,
          attackers: state.combat.attackers.map((a) =>
            a.card === body.attacker ? { ...a, blockerOrder: body.order } : a,
          ),
        },
      };
    }

    case 'AttackerOrderSet': {
      if (!state.combat) return state;
      return {
        ...state,
        combat: {
          ...state.combat,
          blockers: state.combat.blockers.map((b) =>
            b.card === body.blocker ? { ...b, attackerOrder: body.order } : b,
          ),
        },
      };
    }

    case 'FirstStrikeSubstepDecided':
      return state.combat ? { ...state, combat: { ...state.combat, hasFirstStrikeSubstep: body.needed } } : state;

    case 'CombatDamageDealt': {
      const marked = applyDamage(state, body.damages);
      // Mark who has already dealt damage in this sub-step, so a double striker
      // deals in both and everyone else deals in exactly one.
      const combat = state.combat
        ? ({
            ...state.combat,
            attackers: state.combat.attackers.map((a) =>
              body.substep === 'firstStrike' && body.damages.some((d) => d.source === a.card)
                ? { ...a, dealtFirstStrikeDamage: true }
                : a,
            ),
            blockers: state.combat.blockers.map((b) =>
              body.substep === 'firstStrike' && body.damages.some((d) => d.source === b.card)
                ? { ...b, dealtFirstStrikeDamage: true }
                : b,
            ),
          } satisfies CombatState)
        : null;
      // D398 - the turn remembers combat damage dealt to a player (Bloodthirst).
      return { ...marked, combat, turn: { ...marked.turn, memory: recordDamage(marked.turn.memory, body.damages) } };
    }

    case 'RemovedFromCombat': {
      if (!state.combat) return state;
      return {
        ...state,
        combat: {
          ...state.combat,
          attackers: state.combat.attackers.filter((a) => !body.cards.includes(a.card)),
          blockers: state.combat.blockers
            .filter((b) => !body.cards.includes(b.card))
            .map((b) => ({ ...b, attackerOrder: b.attackerOrder.filter((x) => !body.cards.includes(x)) })),
        },
      };
    }

    case 'CombatEnded':
      return { ...state, combat: null };

    // ── Tier 3 / rewind / narration ──────────────────────────────────────
    case 'ManualAction':
    case 'DiceRolled':
    case 'CoinFlipped':
    case 'RewindProposed':
    case 'RewindVoted':
    case 'RewindCancelled':
    case 'RewoundTo':
      // Markers. Rewind is executed by re-folding the log, not by a reducer
      // case — see `log.ts` — because a reducer that could move BACKWARDS would
      // break the append-only invariant everything else depends on.
      return state;

    // ⚠️ Damage from a SPELL, applied by the same helper combat damage uses.
    // Infect, wither, deathtouch, lifelink and the commander tally therefore
    // cannot drift between the two ways damage reaches a permanent or a player.
    case 'DamageDealt': {
      // D398 - the turn remembers damage dealt to a player (Bloodthirst).
      const dealt = applyDamage(state, body.damages);
      return { ...dealt, turn: { ...dealt.turn, memory: recordDamage(dealt.turn.memory, body.damages) } };
    }

    case 'PtModifiedUntilEndOfTurn':
      return {
        ...state,
        untilEndOfTurn: [
          ...state.untilEndOfTurn,
          {
            card: body.card,
            power: body.power,
            toughness: body.toughness,
            // Spread-conditional so an event with no keywords appends the
            // exact pre-D194 entry — hash-identical replays.
            ...(body.keywords !== undefined ? { keywords: body.keywords } : {}),
            ...(body.types !== undefined ? { types: body.types } : {}),
            // D394 - the can't-block restriction rides the same entry, spread-conditional too.
            ...(body.cantBlock !== undefined ? { cantBlock: body.cantBlock } : {}),
            // D399 - the can't-be-blocked evasion rides the same entry, spread-conditional too.
            ...(body.cantBeBlocked !== undefined ? { cantBeBlocked: body.cantBeBlocked } : {}),
            // D395 - the animate family's three fields, spread-conditional too.
            ...(body.basePt !== undefined ? { basePt: body.basePt } : {}),
            ...(body.subtypes !== undefined ? { subtypes: body.subtypes } : {}),
            ...(body.colors !== undefined ? { colors: body.colors } : {}),
          },
        ],
      };

    // D393 - THREATEN: the control change lands on the card (with CR 302.6's summoning sickness -
    // it came under this player's control this turn) and the cleanup revert is remembered on the
    // until-end-of-turn list, in the state hash.
    case 'ControlChangedUntilEndOfTurn': {
      const card = state.cards[body.card];
      if (!card) return state;
      return {
        ...state,
        cards: { ...state.cards, [body.card]: { ...card, controller: body.controller, summonedOnTurn: state.turn.turnNumber } },
        untilEndOfTurn: [...state.untilEndOfTurn, { card: body.card, power: 0, toughness: 0, controlRevert: body.revertTo }],
      };
    }

    // D330 - CR 701.19: a regeneration shield on the permanent, spent by the
    // next destruction this turn.
    case 'BecameRenowned': {
      const card = state.cards[body.card];
      if (!card) return state;
      return { ...state, cards: { ...state.cards, [body.card]: { ...card, renowned: true } } };
    }
    case 'RegenerationShieldAdded':
      return {
        ...state,
        regenerationShields: { ...state.regenerationShields, [body.card]: (state.regenerationShields[body.card] ?? 0) + 1 },
      };
    case 'Regenerated': {
      const left = (state.regenerationShields[body.card] ?? 0) - 1;
      const rest = Object.fromEntries(Object.entries(state.regenerationShields).filter(([k]) => k !== body.card));
      return { ...state, regenerationShields: left > 0 ? { ...rest, [body.card]: left } : rest };
    }

    // D382 - CR 615. The shield is put up here and spent by the funnel; an
    // exhausted numeric one is dropped, an 'all' one stands until cleanup.
    case 'PreventionShieldsAdded':
      return { ...state, preventionShields: [...state.preventionShields, ...body.shields] };
    case 'DamagePrevented': {
      const spent = new Map(body.spends.map((s) => [s.id, s.amount]));
      const next: PreventionShield[] = [];
      for (const shield of state.preventionShields) {
        const take = spent.get(shield.id);
        if (take === undefined || shield.amount === 'all') { next.push(shield); continue; }
        const rest = shield.amount - take;
        if (rest > 0) next.push({ ...shield, amount: rest });
      }
      return { ...state, preventionShields: next };
    }

    // CR 514.2 — every "until end of turn" effect ends at once, at cleanup —
    // the regeneration shields with them (CR 701.19a: "this turn"), and the
    // prevention shields, every printed one of which says "this turn" (D382).
    case 'UntilEndOfTurnEnded':
      return state.untilEndOfTurn.length === 0 &&
        Object.keys(state.regenerationShields).length === 0 &&
        state.preventionShields.length === 0
        ? state
        : { ...state, untilEndOfTurn: [], regenerationShields: {}, preventionShields: [] };

    case 'Narrated':
      return narrate(state, {
        text: body.text,
        player: body.player,
        identity: body.identity,
        manual: body.manual,
        parts: body.parts,
      });

    default: {
      const exhaustive: never = body;
      throw new Error(`apply: unhandled event ${JSON.stringify(exhaustive)}`);
    }
  }
}

function newInstance(
  id: InstanceId,
  oracleId: string,
  printingId: string,
  owner: PlayerId,
  zone: ZoneRef,
  isCommander = false,
): CardInstance {
  return {
    id,
    oracleId,
    printingId,
    owner,
    controller: owner,
    zone,
    tapped: false,
    faceDown: false,
    faceIndex: 0,
    damage: 0,
    deathtouchDamage: false,
    counters: {},
    attachedTo: null,
    attachments: [],
    summonedOnTurn: null,
    isCommander,
    isToken: false,
    renowned: false,
    commanderCastCount: 0,
    ptOverride: null,
    typeOverride: null,
    chosenColor: null,
    revealedTo: [],
    phasedOut: false,
  };
}

export type { RngState };
