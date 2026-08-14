// `Madame Hydra` — a VILLAIN cast pays a Villain token; a plain creature
// cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MADAME_HYDRA_SCRIPT } from './madameHydra';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HYDRA = 'Madame Hydra';
const ENFORCERS = "Kingpin's Enforcers";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function villains(g: Game): number {
  return battlefieldOf(g, 'p1').filter(
    (id) => nameOf(g, id) === 'Villain' && g.state.cards[id]?.isToken,
  ).length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HYDRA, ENFORCERS, BEARS], []],
    scripts: createRegistry([MADAME_HYDRA_SCRIPT]),
  });
  put(g, 'p1', HYDRA);
  settle(g);
  return g;
}

describe('Madame Hydra', () => {
  test('casting a Villain makes a 2/1 Villain token', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    const enforcers = put(g, 'p1', ENFORCERS, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: enforcers }));
    settle(g);
    expect(villains(g)).toBe(1);
  });

  test('a plain creature cast pays nothing — the subtype filter holds', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const bears = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(villains(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    const enforcers = put(g, 'p1', ENFORCERS, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: enforcers }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
