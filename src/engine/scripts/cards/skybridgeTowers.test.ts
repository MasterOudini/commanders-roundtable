// `Skybridge Towers` — the self-sac draw at #a1: the land pays with itself.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYBRIDGE_TOWERS_SCRIPT } from './skybridgeTowers';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bridged(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Skybridge Towers'], []],
    scripts: createRegistry([SKYBRIDGE_TOWERS_SCRIPT]),
  });
  const land = put(g, 'p1', 'Skybridge Towers');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1 }));
  settle(g);
  return { g, before };
}

describe('Skybridge Towers', () => {
  test('the land dies and the draw arrives', () => {
    const { g, before } = bridged();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = bridged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
