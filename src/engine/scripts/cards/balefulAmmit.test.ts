// `Baleful Ammit` — the -1/-1 lands on a creature YOU CONTROL, and an
// opponent's creature is REFUSED by target validation.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BALEFUL_AMMIT_SCRIPT } from './balefulAmmit';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AMMIT = 'Baleful Ammit';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [AMMIT, 'Grizzly Bears'],
      ['Silvercoat Lion'],
    ],
    scripts: createRegistry([BALEFUL_AMMIT_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Silvercoat Lion');
  settle(g);
  const ammit = put(g, 'p1', AMMIT, 'graveyard');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: ammit,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, mine, theirs };
}

describe('Baleful Ammit', () => {
  test("an opponent's creature is REFUSED; a creature you control takes the -1/-1", () => {
    const { g, mine, theirs } = board();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] });
    expect(res.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(g.state.cards[mine]?.counters['-1/-1']).toBe(1);
    expect(g.state.cards[theirs]?.counters['-1/-1']).toBeUndefined();
  });

  test('replays to the same hash', () => {
    const { g, mine } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
