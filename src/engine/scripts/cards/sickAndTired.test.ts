// `Sick and Tired` — TWO targets each get -1/-1: the counted pair with
// both 1/1s dying through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SICK_AND_TIRED_SCRIPT } from './sickAndTired';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sickened(): { g: Game; a: InstanceId; b: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Sick and Tired'],
      ['Aysen Bureaucrats', 'Aysen Bureaucrats'],
    ],
    scripts: createRegistry([SICK_AND_TIRED_SCRIPT]),
  });
  const a = put(g, 'p2', 'Aysen Bureaucrats');
  const b = put(g, 'p2', 'Aysen Bureaucrats');
  expect(a).not.toBe(b);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Sick and Tired', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: a },
        { kind: 'card', id: b },
      ],
    }),
  );
  settle(g);
  return { g, a, b };
}

describe('Sick and Tired', () => {
  test('both 1/1s die at -1/-1', () => {
    const { g, a, b } = sickened();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = sickened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
