// `Inner Calm, Outer Strength` — the hand count at resolution is the X.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INNER_CALM_OUTER_STRENGTH_SCRIPT } from './innerCalmOuterStrength';
import { INNER_CALM_OUTER_STRENGTH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function calmed(): { g: Game; bears: InstanceId; kept: number } {
  const g = startedGame({
    players: 2,
    decks: [['Inner Calm, Outer Strength', 'Grizzly Bears'], []],
    scripts: createRegistry([INNER_CALM_OUTER_STRENGTH_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inner Calm, Outer Strength', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const kept = (g.state.zones.hand['p1'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, kept };
}

describe('Inner Calm, Outer Strength', () => {
  test('the 2/2 reads (2+hand)/(2+hand), and cleanup ends it', () => {
    const { g, bears, kept } = calmed();
    expect(kept).toBeGreaterThan(0);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2 + kept);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INNER_CALM_OUTER_STRENGTH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INNER_CALM_OUTER_STRENGTH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INNER_CALM_OUTER_STRENGTH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = calmed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
