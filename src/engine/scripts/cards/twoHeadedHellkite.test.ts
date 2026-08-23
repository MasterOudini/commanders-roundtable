// `Two-Headed Hellkite` — attacks → draw two, self-filtered: another
// creature attacking alone pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TWO_HEADED_HELLKITE_SCRIPT } from './twoHeadedHellkite';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HELLKITE = 'Two-Headed Hellkite';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

/** Attacks with `who` and reports p1's draws. */
function swing(who: 'hellkite' | 'bears'): number {
  const g = startedGame({
    players: 2,
    decks: [[HELLKITE, BEARS], []],
    scripts: createRegistry([TWO_HEADED_HELLKITE_SCRIPT]),
  });
  const hellkite = put(g, 'p1', HELLKITE);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  const since = g.log.length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        {
          card: who === 'hellkite' ? hellkite : bears,
          defender: { kind: 'player', id: 'p2' },
        },
      ],
    }),
  );
  settle(g);
  return drawn(g, since);
}

describe('Two-Headed Hellkite', () => {
  test('the Hellkite attacking draws TWO', () => {
    expect(swing('hellkite')).toBe(2);
  });

  test('another creature attacking alone draws nothing', () => {
    expect(swing('bears')).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[HELLKITE], []],
      scripts: createRegistry([TWO_HEADED_HELLKITE_SCRIPT]),
    });
    const hellkite = put(g, 'p1', HELLKITE);
    settle(g);
    holdEverywhere(g);
    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 3 &&
        s.turn.activePlayer === 'p1' &&
        s.priority.awaiting?.kind === 'declareAttackers',
      120_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: hellkite, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
