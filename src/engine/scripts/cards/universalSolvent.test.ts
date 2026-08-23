// `Universal Solvent` — the {7}, {T}, self-sacrifice destroy: it eats itself
// whether or not the destroy lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNIVERSAL_SOLVENT_SCRIPT } from './universalSolvent';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SOLVENT = 'Universal Solvent';
const LAND = 'Mountain'; // 'target permanent' — a land is a legal answer
const CITADEL = 'Darksteel Citadel'; // indestructible

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dissolved(victimName: string): { g: Game; solvent: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SOLVENT], [victimName]],
    scripts: createRegistry([UNIVERSAL_SOLVENT_SCRIPT]),
  });
  const solvent = put(g, 'p1', SOLVENT);
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: solvent, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, solvent, victim };
}

describe('Universal Solvent', () => {
  test("a LAND is a legal answer — the noun is 'permanent' — and it dies", () => {
    const { g, solvent, victim } = dissolved(LAND);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[solvent]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE permanent survives and the Solvent is still spent', () => {
    const { g, solvent, victim } = dissolved(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[solvent]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = dissolved(LAND);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
