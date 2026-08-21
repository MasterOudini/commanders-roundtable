// `Puncture Blast` — wither on a creature (counters, not damage), life
// off a player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PUNCTURE_BLAST_SCRIPT } from './punctureBlast';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blasted(target: 'creature' | 'player'): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Puncture Blast'], ['Colossal Dreadmaw']],
    scripts: createRegistry([PUNCTURE_BLAST_SCRIPT]),
  });
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const spell = put(g, 'p1', 'Puncture Blast', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
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

describe('Puncture Blast', () => {
  test('a creature wears wither as -1/-1 counters', () => {
    const { g, dreadmaw } = blasted('creature');
    expect(g.state.cards[dreadmaw]?.counters['-1/-1']).toBe(3);
  });

  test('a player just loses 3', () => {
    const { g } = blasted('player');
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('replays to the same hash', () => {
    const { g } = blasted('creature');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
