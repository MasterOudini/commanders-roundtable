// `Prism Ring` — Diamond Mare's contract on an artifact: the engine asks
// the colour, the def pays only on-colour casts.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRISM_RING_SCRIPT } from './prismRing';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const RING = 'Prism Ring';
const RED = 'Krenko, Mob Boss';
const GREEN = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chosenRed(): Game {
  const g = startedGame({
    players: 2,
    decks: [[RING, RED, GREEN], []],
    scripts: createRegistry([PRISM_RING_SCRIPT]),
  });
  put(g, 'p1', RING);
  must(g.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'R' }));
  settle(g);
  return g;
}

describe('Prism Ring', () => {
  test('a spell of the CHOSEN colour gains 1 life', () => {
    const g = chosenRed();
    const krenko = put(g, 'p1', RED, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: krenko }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 1);
  });

  test('a spell of ANOTHER colour pays nothing', () => {
    const g = chosenRed();
    const bears = put(g, 'p1', GREEN, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore);
  });

  test('replays to the same hash', () => {
    const g = chosenRed();
    const krenko = put(g, 'p1', RED, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: krenko }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
