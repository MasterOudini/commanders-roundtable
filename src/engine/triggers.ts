// The trigger bus and the replacement funnel.
//
// ⚠️ Because EVERY state change goes through an event — including all Tier-3
// manual tools — nothing can change the board without the bus seeing it. There
// is no "and remember to fire triggers here" call site to forget, which is the
// single most common way a rules engine develops a permanently missing trigger.
//
// With `EMPTY_REGISTRY` (what v1 ships) `collectTriggers` iterates an empty
// candidate list and returns []. The built-in commander-zone replacement is the
// one replacement effect that is NOT a card script, because it is a rule.

import { derive, makeDeriveCache } from './derive';
import type { ScriptRegistry } from './scripts/registry';
import type { CardMove, EventBody, GameEvent } from './types/events';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import type { OracleDb } from './types/oracle';
import type { Awaiting, GameState, PendingTrigger } from './types/state';

/**
 * The single funnel every event passes through before it is appended.
 *
 * Returning `[]` prevents the event entirely; returning several replaces it.
 * One funnel means a replacement effect sees every candidate exactly once —
 * with N call sites it would see some of them twice and others never.
 */
export function applyReplacements(
  state: GameState,
  _oracle: OracleDb,
  scripts: ScriptRegistry,
  ev: EventBody,
): EventBody[] {
  let events: EventBody[] = [ev];

  // Built-in: CR 903.9a. A commander that would go to a graveyard or exile from
  // anywhere may go to the command zone instead, at its owner's choice.
  if (ev.t === 'CardsMoved') {
    events = commanderZoneReplacement(state, ev.moves);
  }

  const defs = scripts.replacements();
  if (defs.length === 0) return events;
  // Card scripts get their turn after the built-in, so a script that cares
  // about "goes to the graveyard" sees the destination the rule already chose.
  return events;
}

function commanderZoneReplacement(state: GameState, moves: readonly CardMove[]): EventBody[] {
  const mode = state.options.commanderZoneReplacement;
  if (mode === 'never') return [{ t: 'CardsMoved', moves }];

  const rewritten: CardMove[] = [];
  const queue: { player: PlayerId; card: InstanceId; from: ZoneRef }[] = [];

  for (const move of moves) {
    const card = state.cards[move.card];
    const leavingToBin = move.to.kind === 'graveyard' || move.to.kind === 'exile';
    if (!card || !card.isCommander || card.isToken || !leavingToBin || move.from.kind === 'command') {
      rewritten.push(move);
      continue;
    }
    const owner = state.players[card.owner];
    const always = owner?.commanderZoneAlways;
    if (mode === 'always' || always === true) {
      rewritten.push({ ...move, to: { kind: 'command', player: card.owner } });
      continue;
    }
    if (always === false) {
      rewritten.push(move);
      continue;
    }
    // 'ask': let it land, then offer the choice. Queued rather than a single
    // card, because a wrath can bin both halves of a partner pair at once and
    // abandoning the second would lose a commander with no way back.
    rewritten.push(move);
    queue.push({ player: card.owner, card: move.card, from: move.to });
  }

  const out: EventBody[] = [{ t: 'CardsMoved', moves: rewritten }];
  if (queue.length > 0) {
    const head = queue[0];
    if (head) {
      const awaiting: Awaiting = { kind: 'commanderZoneChoice', player: head.player, queue };
      out.push({ t: 'AwaitingSet', awaiting });
    }
  }
  return out;
}

/**
 * Which triggered abilities fired because of this batch.
 *
 * `before`/`after` are both passed so a trigger can compare — "whenever a
 * creature dies" needs last-known information about an object that no longer
 * exists, which only `before` has.
 */
export function collectTriggers(
  before: GameState,
  after: GameState,
  applied: readonly GameEvent[],
  oracle: OracleDb,
  scripts: ScriptRegistry,
): PendingTrigger[] {
  if (scripts.size === 0) return [];
  const out: PendingTrigger[] = [];
  const cache = makeDeriveCache(after);
  let n = after.eventCount * 1000;

  for (const event of applied) {
    for (const { script, def } of scripts.triggersFor(event.body.t)) {
      for (const id of allObjects(after)) {
        const card = after.cards[id];
        if (!card || card.oracleId !== script.oracleId) continue;
        if (!def.activeZones.includes(card.zone.kind)) continue;
        const ctx = readonlyCtx(after, oracle, scripts, cache);
        if (!def.matches(ctx, id, event.body)) continue;
        out.push({
          id: `t${n++}`,
          source: id,
          controller: card.controller,
          abilityRef: `${script.oracleId}#${def.abilityId}`,
          label: def.label(ctx, id, event.body),
          optional: def.optional,
        });
      }
    }
  }
  void before;
  return out;
}

function allObjects(state: GameState): InstanceId[] {
  return Object.keys(state.cards);
}

function readonlyCtx(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  cache: ReturnType<typeof makeDeriveCache>,
): Parameters<NonNullable<ReturnType<ScriptRegistry['triggersFor']>[number]>['def']['matches']>[0] {
  return {
    state,
    oracle,
    derive: (id: InstanceId) => derive(state, oracle, scripts, id, cache),
    options: state.options,
    ids: {
      nextInstance: () => `c${state.counters.instance + 1}`,
      nextStack: () => `s${state.counters.stack + 1}`,
    },
    query: {
      permanentsOf: (player: PlayerId) =>
        state.zones.battlefield.filter((id) => state.cards[id]?.controller === player),
      controllerOf: (id: InstanceId) => state.cards[id]?.controller ?? null,
      isOnBattlefield: (id: InstanceId) => state.cards[id]?.zone.kind === 'battlefield',
    },
    random: { below: () => 0, shuffled: <T,>(xs: readonly T[]) => xs },
  };
}

/**
 * APNAP order, starting from the active player. CR 603.3b.
 *
 * Ties inside one controller keep the order the bus found them, which is board
 * order — stable, reproducible, and the order the player sees on screen.
 */
export function orderTriggersApnap(
  state: GameState,
  triggers: readonly PendingTrigger[],
): PendingTrigger[] {
  const seats = state.seating;
  const start = Math.max(0, seats.indexOf(state.turn.activePlayer));
  const rank = new Map<PlayerId, number>();
  for (let i = 0; i < seats.length; i++) {
    const id = seats[(start + i) % seats.length];
    if (id) rank.set(id, i);
  }
  return [...triggers].sort(
    (a, b) => (rank.get(a.controller) ?? 99) - (rank.get(b.controller) ?? 99),
  );
}
