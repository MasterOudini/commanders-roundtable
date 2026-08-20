// `Incite Rebellion` — per player: their own creature count, at them and
// at each of their creatures. Asymmetric boards prove the per-player X.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INCITE_REBELLION_SCRIPT } from './inciteRebellion';
import { INCITE_REBELLION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function incited(): { g: Game; mine: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Incite Rebellion', 'Grizzly Bears'],
      ['Colossal Dreadmaw', 'Grizzly Bears', 'Elvish Herder'],
    ],
    scripts: createRegistry([INCITE_REBELLION_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  put(g, 'p2', 'Grizzly Bears');
  put(g, 'p2', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Incite Rebellion', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, big };
}

describe('Incite Rebellion', () => {
  test('I take 1 (one creature), they take 3; my 2/2 carries 1, their smalls die, the 6/6 carries 3', () => {
    const { g, mine, big } = incited();
    expect(g.state.players['p1']?.life).toBe(39);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.damage).toBe(1);
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[big]?.damage).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INCITE_REBELLION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INCITE_REBELLION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INCITE_REBELLION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = incited();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
