// `Seeker of Skybreak` — {T} stands the chosen creature up.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEEKER_OF_SKYBREAK_SCRIPT } from './seekerOfSkybreak';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sought(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seeker of Skybreak', 'Grizzly Bears'], []],
    scripts: createRegistry([SEEKER_OF_SKYBREAK_SCRIPT]),
  });
  const seeker = put(g, 'p1', 'Seeker of Skybreak');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: seeker,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Seeker of Skybreak', () => {
  test('the chosen creature stands up', () => {
    const { g, bears } = sought();
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = sought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
