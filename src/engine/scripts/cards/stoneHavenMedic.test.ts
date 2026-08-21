// `Stone Haven Medic` — the priced tap gains 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STONE_HAVEN_MEDIC_SCRIPT } from './stoneHavenMedic';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function medicked(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Stone Haven Medic'], []],
    scripts: createRegistry([STONE_HAVEN_MEDIC_SCRIPT]),
  });
  const medic = put(g, 'p1', 'Stone Haven Medic');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: medic, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Stone Haven Medic', () => {
  test('the activation gains 1', () => {
    const g = medicked();
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = medicked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
