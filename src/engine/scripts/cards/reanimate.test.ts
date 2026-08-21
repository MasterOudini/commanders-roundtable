// `Reanimate` — steals from an opponent's graveyard for its printed
// mana value in life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REANIMATE_SCRIPT } from './reanimate';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raised(): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Reanimate'], ['Colossal Dreadmaw']],
    scripts: createRegistry([REANIMATE_SCRIPT]),
  });
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw', 'graveyard');
  settle(g);
  const spell = put(g, 'p1', 'Reanimate', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: dreadmaw }] }),
  );
  settle(g);
  return { g, dreadmaw };
}

describe('Reanimate', () => {
  test('the 6-drop rises under MY control and I pay 6', () => {
    const { g, dreadmaw } = raised();
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[dreadmaw]?.controller).toBe('p1');
    expect(g.state.cards[dreadmaw]?.owner).toBe('p2');
    expect(g.state.players['p1']?.life).toBe(34);
  });

  test('replays to the same hash', () => {
    const { g } = raised();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
