// `Reprisal` — the floor holds: a 6/6 dies, a 2/2 is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REPRISAL_SCRIPT } from './reprisal';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reprised(): { g: Game; big: InstanceId; small: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Reprisal'], ['Colossal Dreadmaw', 'Grizzly Bears']],
    scripts: createRegistry([REPRISAL_SCRIPT]),
  });
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  const small = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Reprisal', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const wrong = g.submit({
    t: 'CastSpell',
    player: 'p1',
    card: spell,
    targets: [{ kind: 'card', id: small }],
  });
  expect(wrong.ok).toBe(false);
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: big }] }),
  );
  settle(g);
  return { g, big, small };
}

describe('Reprisal', () => {
  test('the 6/6 dies; the 2/2 was never a legal target', () => {
    const { g, big, small } = reprised();
    expect(g.state.cards[big]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[small]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = reprised();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
