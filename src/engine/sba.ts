// State-based actions — CR 704. One simultaneous pass; `pump()` repeats until a
// pass yields nothing (CR 704.4).
//
// ⚠️ EVERY FINDING IS GATHERED BEFORE ANY IS APPLIED. That is not tidiness: two
// creatures that deal each other lethal damage must BOTH die, and a pass that
// applied the first finding before checking the second would see the second
// creature's killer already gone. The `derive` cache is built once for the whole
// pass for the same reason.

import type { ColorLetter } from '../data/cardTypes';
import { derive, hasLethalDamage, makeDeriveCache, type DeriveCache } from './derive';
import { faceOf } from './oracle';
import { candidateFor, specAdmits } from './targets';
import type { ScriptRegistry } from './scripts/registry';
import type { EventBody, SbaAction } from './types/events';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import type { OracleDb } from './types/oracle';
import type { GameState, LossReason } from './types/state';
import { n, narrated, vb, who } from './narrate';

export interface SbaResult {
  readonly actions: readonly SbaAction[];
  readonly events: readonly EventBody[];
}

const NOTHING: SbaResult = { actions: [], events: [] };

export function checkStateBasedActions(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
): SbaResult {
  if (state.gamePhase !== 'playing') return NOTHING;

  const cache = makeDeriveCache(state);
  const actions: SbaAction[] = [];
  const events: EventBody[] = [];
  const moves: { card: InstanceId; from: ZoneRef; to: ZoneRef }[] = [];
  const doomed = new Set<InstanceId>();

  // 1 — players lose. CR 704.5a/b/c + 903.10b + 704.5c.
  const losers: { player: PlayerId; reason: LossReason }[] = [];
  for (const id of state.seating) {
    const p = state.players[id];
    if (!p || p.hasLost) continue;
    if (p.life <= 0) losers.push({ player: id, reason: 'life' });
    else if (p.drewFromEmptyLibrary) losers.push({ player: id, reason: 'emptyLibrary' });
    else if (p.poison >= state.options.poisonThreshold) losers.push({ player: id, reason: 'poison' });
    else if (
      Object.values(p.commanderDamage).some((v) => v >= state.options.commanderDamageThreshold)
    ) {
      losers.push({ player: id, reason: 'commanderDamage' });
    }
  }
  for (const loss of losers) {
    actions.push({ t: 'playerLoses', player: loss.player, reason: loss.reason });
    events.push({ t: 'PlayerLost', player: loss.player, reason: loss.reason });
    events.push(
      narrated(
        n`${who(state, loss.player)} ${vb(loss.player, 'loses', 'lose')}: ${LOSS_TEXT[loss.reason]}.`,
        loss.player,
      ),
    );
  }

  // 2–8 — the battlefield sweep.
  const counterChanges: { card: InstanceId; kind: string; delta: number }[] = [];
  const detachments: InstanceId[] = [];

  for (const id of state.zones.battlefield) {
    const card = state.cards[id];
    if (!card) continue;
    const d = derive(state, oracle, scripts, id, cache);
    const owner = card.owner;
    const graveyard: ZoneRef = { kind: 'graveyard', player: owner };
    const battlefield: ZoneRef = { kind: 'battlefield', player: card.controller };

    // 8 — +1/+1 and -1/-1 annihilate in pairs. Done first because it can raise
    // toughness back above zero, and doing it after would bin a creature the
    // rules say survives.
    const plus = card.counters['+1/+1'] ?? 0;
    const minus = card.counters['-1/-1'] ?? 0;
    if (plus > 0 && minus > 0) {
      const pairs = Math.min(plus, minus);
      actions.push({ t: 'counterAnnihilation', card: id, amount: pairs });
      counterChanges.push({ card: id, kind: '+1/+1', delta: -pairs });
      counterChanges.push({ card: id, kind: '-1/-1', delta: -pairs });
      continue; // Re-checked next pass with the counters gone.
    }

    // 2 — toughness 0 or less. NOT a destruction: indestructible does not save it.
    if (d.isCreature && d.toughness !== null && d.toughness <= 0) {
      actions.push({ t: 'zeroToughness', card: id });
      moves.push({ card: id, from: battlefield, to: graveyard });
      doomed.add(id);
      continue;
    }

    // 3 — lethal damage. This one IS a destruction, so indestructible saves it.
    if (hasLethalDamage(d, card) && !d.keywords.has('indestructible')) {
      actions.push({ t: 'lethalDamage', card: id });
      moves.push({ card: id, from: battlefield, to: graveyard });
      doomed.add(id);
      continue;
    }

    // 4 — planeswalker at 0 loyalty, battle at 0 defense.
    if (d.typeLine.types.includes('Planeswalker')) {
      const loyalty = card.counters['loyalty'] ?? 0;
      if (loyalty <= 0) {
        actions.push({ t: 'zeroLoyalty', card: id });
        moves.push({ card: id, from: battlefield, to: graveyard });
        doomed.add(id);
        continue;
      }
    }
    if (d.typeLine.types.includes('Battle')) {
      const defense = card.counters['defense'] ?? 0;
      if (defense <= 0) {
        actions.push({ t: 'zeroDefense', card: id });
        moves.push({ card: id, from: battlefield, to: graveyard });
        doomed.add(id);
        continue;
      }
    }

    // 5 — illegal attachments. An Aura falls off (704.5m); Equipment merely
    // unattaches (704.5n), which is a genuinely different outcome and a common
    // mix-up.
    //
    // ⚠️ An Aura with `attachedTo === null` is ALSO illegal. CR 704.5m says "or
    // is not attached to an object or player" — and that is the case that
    // actually fires here, because the reducer detaches both sides the moment
    // the host leaves the battlefield. Checking only "the host is gone" made
    // Pacifism sit on the battlefield forever after its creature died.
    const isAura = d.typeLine.subtypes.includes('Aura');
    const host = card.attachedTo === null ? null : state.cards[card.attachedTo];
    const attachmentIllegal = card.attachedTo !== null && (!host || host.zone.kind !== 'battlefield');
    // D304 - CR 704.5m's other half: an Aura attached to an object its own
    // Enchant ability no longer admits (a "creature you control" the opponent
    // took, a creature that stopped being one, a host that gained protection
    // from the Aura's colour) falls off too. See `enchantAdmits`.
    const enchantIllegal =
      isAura && host !== undefined && host !== null && host.zone.kind === 'battlefield' && !enchantAdmits(state, oracle, scripts, cache, card, d.colors, host.id);
    if (isAura && (card.attachedTo === null || attachmentIllegal || enchantIllegal)) {
      actions.push({ t: 'auraFalls', card: id });
      moves.push({ card: id, from: battlefield, to: graveyard });
      doomed.add(id);
      continue;
    }
    // D305 - CR 301.5c: an Equipment attached to a permanent that is not a
    // creature (the host stopped being one) becomes unattached (CR 704.5n).
    const equipOnNonCreature =
      !isAura &&
      d.typeLine.subtypes.includes('Equipment') &&
      host !== undefined &&
      host !== null &&
      host.zone.kind === 'battlefield' &&
      !derive(state, oracle, scripts, host.id, cache).typeLine.types.includes('Creature');
    if (attachmentIllegal || equipOnNonCreature) {
      actions.push({ t: 'equipmentUnattaches', card: id });
      detachments.push(id);
      continue;
    }
  }

  // 7 — a token outside the battlefield ceases to exist (CR 704.5d).
  //
  // ⚠️ TWO-STEP, deliberately. A dying token first goes to the graveyard via
  // CardsMoved (so a "dies" trigger can see it there), and only the NEXT SBA
  // pass removes it. That ordering is precisely why `pump()` must loop instead
  // of running a single SBA pass.
  const ceased: InstanceId[] = [];
  for (const p of state.seating) {
    for (const zone of ['graveyard', 'exile', 'hand', 'library', 'command'] as const) {
      for (const id of state.zones[zone][p] ?? []) {
        const card = state.cards[id];
        if (!card || !card.isToken) continue;
        actions.push({ t: 'tokenCeasesToExist', card: id });
        ceased.push(id);
        doomed.add(id);
      }
    }
  }

  // 8 — the WORLD rule (CR 704.5m). Two or more permanents with the world
  // supertype: all but the one that has had it for the SHORTEST time are put
  // into their owners' graveyards.
  //
  // ⚠️ **NOT A CHOICE, and that is the difference from the legend rule below.**
  // The legend rule asks its controller which copy to keep; this one has a
  // determined answer — the newest survives — so it moves cards without a
  // prompt. Reading it as "ask like the legend rule" would be a question with
  // one legal answer.
  //
  // ⚠️ **GLOBAL, not per-controller.** The legend rule groups by controller AND
  // name; the world rule looks at the whole battlefield at once, so two players
  // cannot each keep one.
  //
  // ⚠️ THE BATTLEFIELD ARRAY IS THE TIMESTAMP (CR 613.7c, and D129 leans on the
  // same property for the layer system): `addToZone` appends, and a permanent
  // that re-enters goes to the back. So the LAST world permanent in the array is
  // the newest, and everything before it goes. CR's tie case — two gaining the
  // supertype simultaneously — has no representation here, because one array
  // cannot hold two things at one index.
  const worlds: InstanceId[] = [];
  for (const id of state.zones.battlefield) {
    if (doomed.has(id)) continue;
    if (!state.cards[id]) continue;
    if (derive(state, oracle, scripts, id, cache).typeLine.supertypes.includes('World')) {
      worlds.push(id);
    }
  }
  for (const id of worlds.slice(0, -1)) {
    const card = state.cards[id];
    if (!card) continue;
    actions.push({ t: 'worldRule', card: id });
    // ⚠️ From the CONTROLLER's battlefield to the OWNER's graveyard — a stolen
    // world enchantment goes home (CR 404.3), the same asymmetry every other
    // move in this file carries.
    moves.push({
      card: id,
      from: { kind: 'battlefield', player: card.controller },
      to: { kind: 'graveyard', player: card.owner },
    });
    doomed.add(id);
  }

  // 6 — the legend rule. ALWAYS ASK, even for two identical copies: damage,
  // counters and attachments differ, so the choice is real.
  const legendPrompt = findLegendChoice(state, oracle, scripts, cache, doomed);
  if (legendPrompt) {
    actions.push(legendPrompt.action);
    events.push({ t: 'AwaitingSet', awaiting: legendPrompt.awaiting });
  }

  if (counterChanges.length > 0) events.push({ t: 'CountersChanged', changes: counterChanges });
  for (const id of detachments) events.push({ t: 'AttachmentChanged', card: id, to: null });
  if (ceased.length > 0) events.push({ t: 'TokensCeased', cards: ceased });
  if (moves.length > 0) {
    // Tokens are removed from the game rather than piling up in exile: they
    // vanish. Exiling them keeps the id valid for one more pass (so the "dies"
    // window above works) and then they are simply never rendered.
    events.push({ t: 'CardsMoved', moves });
    for (const move of moves) {
      const card = state.cards[move.card];
      if (!card || card.isToken) continue;
      const d = derive(state, oracle, scripts, move.card, cache);
      events.push(
        narrated(`${d.name} dies.`, card.controller, oracle.byPrinting(card.printingId)?.colorIdentity ?? []),
      );
    }
  }

  if (actions.length === 0) return NOTHING;
  return { actions, events: [{ t: 'StateBasedActionsApplied', actions }, ...events] };
}

const LOSS_TEXT: Readonly<Record<LossReason, string>> = {
  life: '0 or less life',
  emptyLibrary: 'drew from an empty library',
  commanderDamage: '21 commander damage',
  poison: '10 poison counters',
  conceded: 'conceded',
};

function findLegendChoice(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  cache: ReturnType<typeof makeDeriveCache>,
  doomed: ReadonlySet<InstanceId>,
): { action: SbaAction; awaiting: NonNullable<GameState['priority']['awaiting']> } | null {
  const groups = new Map<string, InstanceId[]>();
  for (const id of state.zones.battlefield) {
    if (doomed.has(id)) continue;
    const card = state.cards[id];
    if (!card) continue;
    const d = derive(state, oracle, scripts, id, cache);
    if (!d.isLegendary || d.name === '') continue;
    const key = `${card.controller}|${d.name}`;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  for (const [key, ids] of groups) {
    if (ids.length < 2) continue;
    const controller = key.slice(0, key.indexOf('|'));
    const name = key.slice(key.indexOf('|') + 1);
    // ⚠️ Do not re-ask a question that is already on screen. `advance()` runs
    // the SBA pass BEFORE the awaiting check (CR 117.5 requires that order), so
    // an SBA that emits a prompt would emit it again on every single iteration
    // — `pump` hit its 10 000-iteration cap the moment a second Krenko landed.
    const current = state.priority.awaiting;
    if (current?.kind === 'chooseLegendKeep' && current.player === controller && current.name === name) {
      continue;
    }
    return {
      action: { t: 'legendRule', player: controller, name, candidates: ids },
      awaiting: { kind: 'chooseLegendKeep', player: controller, name, candidates: ids },
    };
  }
  return null;
}

/**
 * Who has won, if anyone. Run after every SBA pass that made someone lose.
 *
 * A four-player game can have simultaneous losses; if everyone remaining loses
 * at once the game is a DRAW, which `winners: []` expresses without a special
 * "draw" flag that three other places would have to check.
 */
/**
 * D304 - does the Aura's own Enchant ability still admit its host? Asked of the
 * SAME spec the cast targeted with (`parseSpellTargets` reads an Aura's Enchant
 * line into its one target), through `specAdmits` - the targeting predicate
 * minus hexproof and shroud, which restrict TARGETING and never an attachment
 * already made (CR 702.11b, 702.18b) - plus protection, which does unattach
 * (CR 702.16e). A free-aim spec (nothing read) admits anything, as at the cast.
 */
function enchantAdmits(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  cache: DeriveCache,
  aura: NonNullable<GameState['cards'][InstanceId]>,
  auraColors: readonly ColorLetter[],
  hostId: InstanceId,
): boolean {
  const printing = oracle.byPrinting(aura.printingId);
  const spec = printing ? faceOf(printing, aura.faceIndex).targets[0] : undefined;
  if (!spec || spec.kinds.length === 0) return true;
  const host = candidateFor(state, { oracle, scripts }, hostId, 'battlefield', cache);
  if (!host) return false;
  if (host.protection.fromEverything || host.protection.colors.some((col) => auraColors.includes(col))) return false;
  return specAdmits(spec, { controller: aura.controller, colors: auraColors }, host);
}

export function checkGameOver(state: GameState): EventBody[] {
  if (state.gamePhase !== 'playing') return [];
  const alive = state.seating.filter((id) => !(state.players[id]?.hasLost ?? true));
  if (alive.length > 1) return [];
  const events: EventBody[] = [{ t: 'GameEnded', winners: alive }];
  events.push(
    narrated(
      alive.length === 1
        ? n`${who(state, alive[0] ?? '')} ${vb(alive[0] ?? '', 'wins', 'win')}.`
        : 'The game is a draw.',
      // A draw belongs to nobody; a win belongs to the winner.
      alive.length === 1 ? (alive[0] ?? null) : null,
    ),
  );
  return events;
}
