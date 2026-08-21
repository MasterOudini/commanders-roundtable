// `Sorin's Vengeance` — 10 to the player, 10 to the caster's total.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SORINS_VENGEANCE_SCRIPT } from './sorinsVengeance';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function avenged(): Game {
  const g = startedGame({
    players: 2,
    decks: [["Sorin's Vengeance"], []],
    scripts: createRegistry([SORINS_VENGEANCE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Sorin's Vengeance", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe("Sorin's Vengeance", () => {
  test('p2 takes 10 and the caster gains 10', () => {
    const g = avenged();
    expect(g.state.players['p2']?.life).toBe(30);
    expect(g.state.players['p1']?.life).toBe(50);
  });

  test('replays to the same hash', () => {
    const g = avenged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
