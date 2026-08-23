// `Warped Physique` — X is MY hand size at RESOLUTION, and -X can kill.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WARPED_PHYSIQUE_SCRIPT } from './warpedPhysique';
import { WARPED_PHYSIQUE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Warped Physique';
const TITAN = 'Grave Titan'; // 6/6 — survives a small -X

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; victim: InstanceId; x: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [TITAN]],
    scripts: createRegistry([WARPED_PHYSIQUE_SCRIPT]),
  });
  const victim = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  // ⚠️ X is read at RESOLUTION, by which point the spell has left my hand —
  // so the expected X is the hand size WITH the spell already on the stack.
  const x = (g.state.zones.hand['p1'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim, x };
}

describe('Warped Physique', () => {
  test('the target is +X/-X for X = my hand size at resolution', () => {
    const { g, victim, x } = cast();
    expect(x).toBeGreaterThan(0);
    const d = deps(createRegistry([WARPED_PHYSIQUE_SCRIPT]));
    const got = derive(g.state, d.oracle, d.scripts, victim);
    expect(got.power).toBe(6 + x);
    expect(got.toughness).toBe(6 - x);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WARPED_PHYSIQUE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WARPED_PHYSIQUE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WARPED_PHYSIQUE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
