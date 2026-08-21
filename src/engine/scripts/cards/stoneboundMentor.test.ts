// `Stonebound Mentor` — a card LEAVING my graveyard raises the scry; a
// card leaving an opponent's raises nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STONEBOUND_MENTOR_SCRIPT } from './stoneboundMentor';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mentored(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Stonebound Mentor', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([STONEBOUND_MENTOR_SCRIPT]),
  });
  put(g, 'p1', 'Stonebound Mentor');
  const mine = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const theirs = put(g, 'p2', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  // An OPPONENT'S graveyard emptying asks nothing.
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: theirs,
      to: { kind: 'hand', player: 'p2' },
    }),
  );
  settle(g);
  if (g.state.priority.awaiting !== null) throw new Error("an opponent's exit must ask nothing");
  // MY graveyard emptying raises the scry.
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: mine,
      to: { kind: 'hand', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Stonebound Mentor', () => {
  test('my graveyard exit asks; the opponent’s does not', () => {
    const g = mentored();
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = mentored();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
