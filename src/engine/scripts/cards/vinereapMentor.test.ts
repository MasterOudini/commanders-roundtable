// `Vinereap Mentor` — one printed line, TWO defs: the Food comes on the way
// in AND on the way out, so a Mentor that enters and dies leaves two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VINEREAP_MENTOR_SCRIPT } from './vinereapMentor';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MENTOR = 'Vinereap Mentor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function food(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food').length;
}

function entered(): { g: Game; mentor: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MENTOR], []],
    scripts: createRegistry([VINEREAP_MENTOR_SCRIPT]),
  });
  const mentor = put(g, 'p1', MENTOR);
  settle(g);
  return { g, mentor };
}

describe('Vinereap Mentor', () => {
  test('the entry makes a Food', () => {
    const { g } = entered();
    expect(food(g)).toBe(1);
  });

  test('the death makes a SECOND one', () => {
    const { g, mentor } = entered();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: mentor,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(g.state.cards[mentor]?.zone.kind).toBe('graveyard');
    expect(food(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, mentor } = entered();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: mentor,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
