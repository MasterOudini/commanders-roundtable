// `Sarkhan's Rage` — no Dragons: 5 to the target and 2 back; a Dragon on
// the board silences the recoil.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SARKHANS_RAGE_SCRIPT } from './sarkhansRage';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raged(withDragon: boolean): Game {
  const g = startedGame({
    players: 2,
    decks: [["Sarkhan's Rage", 'Boulderborn Dragon'], []],
    scripts: createRegistry([SARKHANS_RAGE_SCRIPT]),
  });
  if (withDragon) put(g, 'p1', 'Boulderborn Dragon');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Sarkhan's Rage", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe("Sarkhan's Rage", () => {
  test('no Dragons: 5 to the target and 2 back to me', () => {
    const g = raged(false);
    expect(g.state.players['p2']?.life).toBe(35);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('a Dragon silences the recoil', () => {
    const g = raged(true);
    expect(g.state.players['p2']?.life).toBe(35);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = raged(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
