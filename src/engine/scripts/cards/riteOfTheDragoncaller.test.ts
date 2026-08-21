// `Rite of the Dragoncaller` — an instant cast pays a Dragon; a creature
// cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RITE_OF_THE_DRAGONCALLER_SCRIPT } from './riteOfTheDragoncaller';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokensOf(g: Game, player: string): number {
  return (g.state.zones.battlefield ?? []).filter(
    (id) => g.state.cards[id]?.isToken && g.state.cards[id]?.controller === player,
  ).length;
}

function rited(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Rite of the Dragoncaller', 'Lightning Bolt', 'Grizzly Bears'], []],
    scripts: createRegistry([RITE_OF_THE_DRAGONCALLER_SCRIPT]),
  });
  put(g, 'p1', 'Rite of the Dragoncaller');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

describe('Rite of the Dragoncaller', () => {
  test('an instant cast pays a Dragon; a creature cast pays nothing', () => {
    const g = rited();
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(tokensOf(g, 'p1')).toBe(1);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(tokensOf(g, 'p1')).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = rited();
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
