// `Galvanic Bombardment` — two dead copies make X = 4, marked on a 6/6
// that survives to show the number.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GALVANIC_BOMBARDMENT_SCRIPT } from './galvanicBombardment';
import { GALVANIC_BOMBARDMENT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bombarded(): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Galvanic Bombardment', 'Galvanic Bombardment', 'Galvanic Bombardment'],
      ['Colossal Dreadmaw'],
    ],
    scripts: createRegistry([GALVANIC_BOMBARDMENT_SCRIPT]),
  });
  const a = put(g, 'p1', 'Galvanic Bombardment', 'graveyard');
  const b = put(g, 'p1', 'Galvanic Bombardment', 'graveyard');
  expect(b).not.toBe(a);
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Galvanic Bombardment', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dreadmaw }] }));
  settle(g);
  return { g, dreadmaw };
}

describe('Galvanic Bombardment', () => {
  test('X is 2 plus the two namesakes in my graveyard — 4 marked on the 6/6', () => {
    const { g, dreadmaw } = bombarded();
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[dreadmaw]?.damage).toBe(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GALVANIC_BOMBARDMENT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GALVANIC_BOMBARDMENT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GALVANIC_BOMBARDMENT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bombarded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
