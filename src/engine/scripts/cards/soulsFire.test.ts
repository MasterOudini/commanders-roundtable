// `Soul's Fire` — the Titan's 6 lands on p2; the biter stays home.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULS_FIRE_SCRIPT } from './soulsFire';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(): Game {
  const g = startedGame({
    players: 2,
    decks: [["Soul's Fire", 'Grave Titan'], []],
    scripts: createRegistry([SOULS_FIRE_SCRIPT]),
  });
  const titan = put(g, 'p1', 'Grave Titan');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Soul's Fire", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: titan },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return g;
}

describe("Soul's Fire", () => {
  test("the Titan's 6 power lands on p2", () => {
    const g = fired();
    expect(g.state.players['p2']?.life).toBe(34);
  });

  test('replays to the same hash', () => {
    const g = fired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
