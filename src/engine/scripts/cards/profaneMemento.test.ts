// `Profane Memento` — a creature card in an opponent's graveyard pays 1
// per CARD; my own graveyard and their lands pay nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PROFANE_MEMENTO_SCRIPT } from './profaneMemento';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function remembered(): { g: Game; theirs: string; theirLand: string; mine: string } {
  const g = startedGame({
    players: 2,
    decks: [['Profane Memento', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([PROFANE_MEMENTO_SCRIPT]),
  });
  put(g, 'p1', 'Profane Memento');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const theirLand = put(g, 'p2', 'Mountain');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  return { g, theirs, theirLand, mine };
}

describe('Profane Memento', () => {
  test('their creature death pays 1; their land and my creature pay nothing', () => {
    const { g, theirs, theirLand, mine } = remembered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirLand, to: { kind: 'graveyard', player: 'p2' } }),
    );
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mine, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = remembered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirs, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
