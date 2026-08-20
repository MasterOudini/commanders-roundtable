// `Harmonic Convergence` — both players' enchantments land on their own
// library TOPS; the creature stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HARMONIC_CONVERGENCE_SCRIPT } from './harmonicConvergence';
import { HARMONIC_CONVERGENCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function converged(): { g: Game; flame: InstanceId; plans: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Harmonic Convergence', 'Captive Flame'], ['Hatching Plans', 'Grizzly Bears']],
    scripts: createRegistry([HARMONIC_CONVERGENCE_SCRIPT]),
  });
  const flame = put(g, 'p1', 'Captive Flame');
  const plans = put(g, 'p2', 'Hatching Plans');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Harmonic Convergence', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flame, plans, bears };
}

describe('Harmonic Convergence', () => {
  test("each enchantment tops its OWNER's library; the creature stands", () => {
    const { g, flame, plans, bears } = converged();
    const mine = g.state.zones.library['p1'] ?? [];
    const theirs = g.state.zones.library['p2'] ?? [];
    expect(mine[mine.length - 1]).toBe(flame);
    expect(theirs[theirs.length - 1]).toBe(plans);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HARMONIC_CONVERGENCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HARMONIC_CONVERGENCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HARMONIC_CONVERGENCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = converged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
