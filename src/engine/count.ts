// D418 - THE COUNT EXPRESSION, read at resolution.
//
// `<effect> for each <noun>.` and `<effect with X>, where X is the number of <nouns>.` carry
// a `CountExpr` on the spec (`EffectSpec.per`); the executor multiplies the amount by what
// this file counts NOW, on the resolving board (CR 608.2h: a value is determined as the
// effect resolves, once). Nothing here mutates: it is a read over the state the executor
// already has, using the same `derive` the board uses, so a Levitation-granted flier and a
// face-down 2/2 count as what they ARE and not as what is printed.

import { derive, type DeriveCache } from './derive';
import type { EngineDeps } from './loop';
import type { InstanceId, PlayerId } from './types/ids';
import type { CountExpr } from './types/oracle';
import type { GameState } from './types/state';
import { predicateAdmits } from '../data/replacementParse';

/** The four party roles (CR 702.139): one creature may fill one role. */
const PARTY_ROLES = ['Cleric', 'Rogue', 'Warrior', 'Wizard'] as const;
const BASIC_TYPES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

/**
 * How many the expression counts for `controller`, from `source` (the resolving card, for
 * `other` and the kicked count) on the board as it is now. Never negative.
 */
export function countOf(
  state: GameState,
  deps: EngineDeps,
  controller: PlayerId,
  expr: CountExpr,
  source: InstanceId | null,
  kicked: number,
  cache: DeriveCache | undefined,
): number {
  const d = (id: InstanceId) => derive(state, deps.oracle, deps.scripts, id, cache);
  switch (expr.kind) {
    case 'kicked':
      return Math.max(0, kicked);
    case 'cardsInHand':
      return (state.zones.hand[controller] ?? []).length;
    case 'players': {
      const alive = Object.values(state.players).filter((p) => !p.hasLost);
      return expr.who === 'any' ? alive.length : alive.filter((p) => p.id !== controller).length;
    }
    case 'diedThisTurn':
      // The turn remembers IDS (the reducer has no oracle); the creature question is asked here.
      return state.turn.memory.died.filter((e) => d(e.card).isCreature).length;
    case 'cardsInGraveyard': {
      const preds = expr.predicates;
      return (state.zones.graveyard[controller] ?? []).filter((id) => {
        const chars = d(id);
        if (preds !== null && !predicateAdmits(chars, preds)) return false;
        return expr.named === null || chars.name === expr.named;
      }).length;
    }
    case 'basicLandTypes': {
      const seen = new Set<string>();
      for (const id of state.zones.battlefield) {
        const inst = state.cards[id];
        if (!inst || inst.controller !== controller) continue;
        const chars = d(id);
        if (!chars.isLand) continue;
        for (const t of BASIC_TYPES) if (chars.typeLine.subtypes.includes(t)) seen.add(t);
      }
      return seen.size;
    }
    case 'party': {
      // The largest set of the controller's creatures that fills distinct roles: four roles,
      // so the search is tiny and exact.
      const roleHolders = PARTY_ROLES.map((role) =>
        state.zones.battlefield.filter((id) => {
          const inst = state.cards[id];
          if (!inst || inst.controller !== controller) return false;
          const chars = d(id);
          return chars.isCreature && chars.typeLine.subtypes.includes(role);
        }),
      );
      const best = (i: number, used: ReadonlySet<InstanceId>): number => {
        if (i === roleHolders.length) return 0;
        let top = best(i + 1, used);
        for (const id of roleHolders[i] ?? []) {
          if (used.has(id)) continue;
          const next = new Set(used);
          next.add(id);
          top = Math.max(top, 1 + best(i + 1, next));
        }
        return top;
      };
      return best(0, new Set());
    }
    case 'permanents': {
      const attackers = new Set((state.combat?.attackers ?? []).map((a) => a.card));
      let n = 0;
      for (const id of state.zones.battlefield) {
        const inst = state.cards[id];
        if (!inst) continue;
        if (expr.other && id === source) continue;
        if (expr.controller === 'you' && inst.controller !== controller) continue;
        if (expr.controller === 'opponents' && inst.controller === controller) continue;
        if (expr.attacking && !attackers.has(id)) continue;
        if (expr.untapped && inst.tapped) continue;
        if (expr.withPlusCounter && (inst.counters['+1/+1'] ?? 0) <= 0) continue;
        const chars = d(id);
        if (!predicateAdmits(chars, expr.predicates)) continue;
        if (expr.keyword !== null && !chars.keywords.has(expr.keyword)) continue;
        if (expr.powerAtLeast !== null && (chars.power ?? 0) < expr.powerAtLeast) continue;
        if (expr.named !== null && chars.name !== expr.named) continue;
        n++;
      }
      return n;
    }
  }
}
