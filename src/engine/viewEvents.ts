// Engine events → the 21 animation cues `src/view/types.ts` declares.
//
// ⚠️ THE SEAM. `src/ui/anim/coalesce.ts` already maps every one of those 21
// kinds to a beat, and a kind with no beat is silently invisible — so this file
// translates rather than inventing. If the engine ever needs a new cue, the
// change lands in THREE files together: `view/types.ts`, `coalesce.ts` and
// `beats.ts`.
//
// ⚠️ `stepId` is carried straight through from the engine event. One
// `advance()` call is one group, which is what makes LIFO stack resolution
// visibly ordered while independent things inside a group still overlap.

import { render } from './narrate';
import type { GameEvent, SbaAction } from './types/events';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import type { GameState } from './types/state';
import type { EngineEvent, ManaSymbol, PhaseId, ZoneId } from '../view/types';
import { zoneId } from '../view/types';
import type { Step } from './types/state';

const STEP_TO_PHASE: Readonly<Record<Step, PhaseId>> = {
  untap: 'untap',
  upkeep: 'upkeep',
  draw: 'draw',
  precombatMain: 'main1',
  beginCombat: 'beginCombat',
  declareAttackers: 'attackers',
  declareBlockers: 'blockers',
  // Both damage sub-steps land on one track segment: the track shows PHASES,
  // and a separate pip for first strike would move for half the games ever
  // played and stay still for the rest.
  firstStrikeDamage: 'combatDamage',
  combatDamage: 'combatDamage',
  endCombat: 'endCombat',
  postcombatMain: 'main2',
  end: 'end',
  cleanup: 'cleanup',
};

export function viewZone(ref: ZoneRef): ZoneId {
  switch (ref.kind) {
    case 'battlefield':
      return zoneId('bf', ref.player ?? '');
    case 'library':
      return zoneId('lib', ref.player ?? '');
    case 'hand':
      return zoneId('hand', ref.player ?? '');
    case 'graveyard':
      return zoneId('gy', ref.player ?? '');
    case 'exile':
      return zoneId('exile', ref.player ?? '');
    case 'command':
      return zoneId('cmd', ref.player ?? '');
    case 'stack':
      return 'stack';
  }
}

/** Which SBA outcomes read to a player as "that permanent died". */
function deathsFrom(actions: readonly SbaAction[]): InstanceId[] {
  const out: InstanceId[] = [];
  for (const a of actions) {
    if (
      a.t === 'lethalDamage' ||
      a.t === 'zeroToughness' ||
      a.t === 'zeroLoyalty' ||
      a.t === 'zeroDefense' ||
      a.t === 'auraFalls'
    ) {
      out.push(a.card);
    }
  }
  return out;
}

/**
 * Translate one batch for one viewer.
 *
 * `after` is the state the batch produced — the same state that will be
 * committed alongside these events, so a cue never describes a board the view
 * does not yet show.
 */
export function toViewEvents(
  events: readonly GameEvent[],
  after: GameState,
  viewer: PlayerId,
): EngineEvent[] {
  const out: EngineEvent[] = [];
  // ⚠️ Narration ids come from the reducer's counter, not from a local one, so
  // the entry the GameLog animates is the SAME entry `project()` puts in
  // `view.log`. Two ids for one line makes the windowed log flicker as it
  // re-keys, which reads as a rendering bug rather than a numbering one.
  const narratedTotal = events.reduce((n, e) => n + (e.body.t === 'Narrated' ? 1 : 0), 0);
  let narratedSeen = 0;
  const canSee = (id: InstanceId): boolean => {
    const card = after.cards[id];
    if (!card) return false;
    if (card.zone.kind === 'library') return card.revealedTo.includes(viewer);
    if (card.zone.kind === 'hand') return card.zone.player === viewer || card.revealedTo.includes(viewer);
    return true;
  };

  for (const event of events) {
    const stepId = event.stepId;
    const body = event.body;
    switch (body.t) {
      case 'CardsMoved': {
        for (const move of body.moves) {
          // A shuffle moves a hand back into a library card by card; animating
          // seven flights into an opaque pile is noise, not information.
          if (move.from.kind === 'library' && move.to.kind === 'library') continue;
          if (move.from.kind === 'library' && move.to.kind === 'hand') {
            out.push({ t: 'CardDrawn', stepId, player: move.to.player ?? '', instanceId: move.card });
            continue;
          }
          out.push({
            t: 'CardMoved',
            stepId,
            instanceId: move.card,
            from: viewZone(move.from),
            to: viewZone(move.to),
            faceUpAtEnd: canSee(move.card) && !(after.cards[move.card]?.faceDown ?? false),
          });
          if (move.to.kind === 'battlefield') {
            out.push({
              t: 'PermanentEntered',
              stepId,
              instanceId: move.card,
              isLand: move.from.kind === 'hand',
            });
          }
        }
        break;
      }

      case 'TokenCreated':
        out.push({ t: 'TokenCreated', stepId, instanceId: body.card });
        break;

      case 'CardsRevealed':
        for (const id of body.cards) {
          if (!body.to.includes(viewer)) continue;
          out.push({ t: 'CardRevealed', stepId, instanceId: id });
        }
        break;

      case 'PermanentsTapped':
        for (const id of body.cards) out.push({ t: 'PermanentTapped', stepId, instanceId: id });
        break;

      case 'PermanentsUntapped':
        for (const id of body.cards) out.push({ t: 'PermanentUntapped', stepId, instanceId: id });
        break;

      case 'CountersChanged':
        for (const c of body.changes) {
          out.push({ t: 'CounterChanged', stepId, instanceId: c.card, kind: c.kind, delta: c.delta });
        }
        break;

      case 'LifeChanged':
        out.push({
          t: 'LifeChanged',
          stepId,
          player: body.player,
          from: body.to - body.delta,
          to: body.to,
        });
        break;

      case 'ManaAdded':
        for (const key of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
          const amount = body.mana[key];
          if (amount > 0) {
            out.push({ t: 'ManaAdded', stepId, player: body.player, symbol: key as ManaSymbol, amount });
          }
        }
        break;

      case 'ManaPoolEmptied':
        out.push({ t: 'ManaPoolEmptied', stepId, player: body.player });
        break;

      case 'SpellCast':
        out.push({
          t: 'SpellCast',
          stepId,
          instanceId: body.obj.card ?? '',
          from: body.obj.castFrom ? viewZone(body.obj.castFrom) : zoneId('hand', body.obj.controller),
          controller: body.obj.controller,
          stackItemId: body.obj.id,
        });
        break;

      case 'AbilityPutOnStack':
        out.push({
          t: 'AbilityActivated',
          stepId,
          sourceInstanceId: body.obj.source ?? '',
          stackItemId: body.obj.id,
        });
        break;

      case 'StackResolved':
        out.push({
          t: 'StackResolved',
          stepId,
          stackItemId: body.stackId,
          instanceId: body.card,
          to: body.to ? viewZone(body.to) : null,
          targets: body.targets.map((t) => ({ kind: t.kind, id: t.id })),
          controller: body.controller,
        });
        break;

      // ⚠️ `controller: null` and it is not a shrug: a fizzled or countered
      // spell carries `instanceId: null` too, so nothing downstream can offer
      // anything for it. Naming a controller here would be inventing one.
      case 'SpellFizzled':
      case 'SpellCountered':
        out.push({
          t: 'StackResolved',
          stepId,
          stackItemId: body.stackId,
          instanceId: null,
          to: null,
          targets: [],
          controller: null,
        });
        break;

      // ⚠️ Spell damage animates through the SAME `DamageDealt` view event
      // combat damage does, so three damage from a Bolt punches the card exactly
      // as three damage from an attacker would. A player should not be able to
      // tell where damage came from by how it moved.
      case 'DamageDealt':
      case 'CombatDamageDealt':
        for (const damage of body.damages) {
          out.push({
            t: 'DamageDealt',
            stepId,
            target: damage.target.id,
            targetKind: damage.target.kind,
            amount: damage.amount,
            commander: damage.isCommanderDamage,
            source: damage.source,
          });
        }
        break;

      case 'AttackersDeclared':
        out.push({
          t: 'AttackersDeclared',
          stepId,
          attackers: body.attackers.map((a) => ({
            instanceId: a.card,
            defender:
              a.defender.kind === 'player'
                ? a.defender.id
                : (after.cards[a.defender.id]?.controller ?? ''),
          })),
        });
        break;

      case 'BlockersDeclared':
        out.push({ t: 'BlockersDeclared', stepId, blocks: [...body.blocks] });
        break;

      case 'StateBasedActionsApplied': {
        const deaths = deathsFrom(body.actions);
        for (const id of deaths) out.push({ t: 'PermanentDied', stepId, instanceId: id });
        break;
      }

      case 'StepBegan':
        out.push({
          t: 'PhaseChanged',
          stepId,
          phase: STEP_TO_PHASE[body.step],
          turnNumber: after.turn.turnNumber,
          active: after.turn.activePlayer,
        });
        break;

      case 'TurnBegan':
        out.push({
          t: 'PhaseChanged',
          stepId,
          phase: 'untap',
          turnNumber: body.turnNumber,
          active: body.activePlayer,
        });
        break;

      case 'PriorityGranted':
        out.push({ t: 'PriorityChanged', stepId, player: body.player });
        break;

      case 'PriorityPassed':
        out.push({ t: 'PriorityChanged', stepId, player: null });
        break;

      case 'PlayerLost':
        out.push({ t: 'PlayerLost', stepId, player: body.player, reason: body.reason });
        break;

      case 'Narrated': {
        const line = after.narration[after.narration.length - narratedTotal + narratedSeen];
        narratedSeen++;
        out.push({
          t: 'Logged',
          stepId,
          entry: {
            id: line?.id ?? after.counters.logLine,
            // ⚠️ Rendered for THIS viewer, exactly as `project()` renders it.
            // The cue and the view must agree, or the row that animates in says
            // something different from the row that stays.
            text: render(body.parts, viewer),
            player: body.player,
            identity: [...body.identity],
            manual: body.manual,
          },
        });
        break;
      }

      default:
        break;
    }
  }
  return out;
}
