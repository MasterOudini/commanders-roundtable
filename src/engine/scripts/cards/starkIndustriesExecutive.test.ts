// `Stark Industries Executive` — the priced Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STARK_INDUSTRIES_EXECUTIVE_SCRIPT } from './starkIndustriesExecutive';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function executed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Stark Industries Executive'], []],
    scripts: createRegistry([STARK_INDUSTRIES_EXECUTIVE_SCRIPT]),
  });
  const exec = put(g, 'p1', 'Stark Industries Executive');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: exec, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Stark Industries Executive', () => {
  test('the activation pays a Treasure', () => {
    const g = executed();
    const tokens = (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken);
    expect(tokens).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = executed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
