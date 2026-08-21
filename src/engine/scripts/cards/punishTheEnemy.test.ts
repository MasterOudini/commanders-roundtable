// `Punish the Enemy` — two targets, one bolt each.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PUNISH_THE_ENEMY_SCRIPT } from './punishTheEnemy';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function punished(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Punish the Enemy'], ['Grizzly Bears']],
    scripts: createRegistry([PUNISH_THE_ENEMY_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Punish the Enemy', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'player', id: 'p2' },
        { kind: 'card', id: bears },
      ],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Punish the Enemy', () => {
  test('the player takes 3 and the 2/2 dies to its own 3', () => {
    const { g, bears } = punished();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = punished();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
