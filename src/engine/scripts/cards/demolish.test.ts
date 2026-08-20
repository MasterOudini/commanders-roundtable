// `Demolish` — an artifact target and a land target both die; Darksteel
// Citadel (an indestructible artifact land) survives it from either noun.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEMOLISH_SCRIPT } from './demolish';
import { DEMOLISH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function razed(name: 'Mountain' | 'Darksteel Citadel'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Demolish'], ['Mountain', 'Darksteel Citadel']],
    scripts: createRegistry([DEMOLISH_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Demolish', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Demolish', () => {
  test('a land dies to it', () => {
    const { g, victim } = razed('Mountain');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('Darksteel Citadel survives (CR 701.7b) and the spell stays spent', () => {
    const { g, victim } = razed('Darksteel Citadel');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEMOLISH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEMOLISH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEMOLISH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = razed('Mountain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
