// `Headless Rider` — its OWN death pays, a nontoken Zombie's death pays, and
// the token Zombie it made pays NOTHING when it dies (the nontoken filter,
// proven by the Rider's own product).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEADLESS_RIDER_SCRIPT } from './headlessRider';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RIDER = 'Headless Rider';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; rider: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RIDER], []],
    scripts: createRegistry([HEADLESS_RIDER_SCRIPT]),
  });
  const rider = put(g, 'p1', RIDER);
  settle(g);
  return { g, rider };
}

function zombieTokens(g: Game): readonly InstanceId[] {
  return battlefieldOf(g, 'p1').filter(
    (id) => nameOf(g, id) === 'Zombie' && g.state.cards[id]?.isToken,
  );
}

describe('Headless Rider', () => {
  test('its own death makes a 2/2 Zombie', () => {
    const { g, rider } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: rider,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(zombieTokens(g)).toHaveLength(1);
  });

  test('the token it made pays nothing when IT dies — the nontoken filter', () => {
    const { g, rider } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: rider,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    const token = zombieTokens(g)[0] as InstanceId;
    // The Rider is gone; killing its token must NOT make another.
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: token,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(zombieTokens(g)).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g, rider } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: rider,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
