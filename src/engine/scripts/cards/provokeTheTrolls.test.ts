// `Provoke the Trolls` — a burned creature gets angry; a burned player
// just gets burned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PROVOKE_THE_TROLLS_SCRIPT } from './provokeTheTrolls';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function provoked(target: 'creature' | 'player'): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Provoke the Trolls'], ['Colossal Dreadmaw']],
    scripts: createRegistry([PROVOKE_THE_TROLLS_SCRIPT]),
  });
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const spell = put(g, 'p1', 'Provoke the Trolls', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        target === 'creature' ? { kind: 'card', id: dreadmaw } : { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return { g, dreadmaw };
}

describe('Provoke the Trolls', () => {
  test('a burned 6/6 reads 11/6 with 3 marked', () => {
    const { g, dreadmaw } = provoked('creature');
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, dreadmaw).power).toBe(11);
  });

  test('a burned player takes 3 and nothing pumps', () => {
    const { g, dreadmaw } = provoked('player');
    expect(g.state.players['p2']?.life).toBe(37);
    expect(derive(g.state, ORACLE, g.deps.scripts, dreadmaw).power).toBe(6);
  });

  test('replays to the same hash', () => {
    const { g } = provoked('creature');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
