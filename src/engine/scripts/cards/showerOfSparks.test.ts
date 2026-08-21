// `Shower of Sparks` — 1 to the creature AND 1 to the player, one cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHOWER_OF_SPARKS_SCRIPT } from './showerOfSparks';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function showered(): { g: Game; small: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Shower of Sparks'],
      ['Aysen Bureaucrats'],
    ],
    scripts: createRegistry([SHOWER_OF_SPARKS_SCRIPT]),
  });
  const small = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Shower of Sparks', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: small },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return { g, small };
}

describe('Shower of Sparks', () => {
  test('the 1/1 dies and the player takes 1', () => {
    const { g, small } = showered();
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g } = showered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
