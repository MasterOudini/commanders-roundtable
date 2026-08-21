// `Sultai Banner` — the #a1 self-sac draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SULTAI_BANNER_SCRIPT } from './sultaiBanner';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bannered(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Sultai Banner'], []],
    scripts: createRegistry([SULTAI_BANNER_SCRIPT]),
  });
  const banner = put(g, 'p1', 'Sultai Banner');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: banner, abilityIndex: 1 }));
  settle(g);
  return { g, before };
}

describe('Sultai Banner', () => {
  test('the Banner dies and the draw arrives', () => {
    const { g, before } = bannered();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = bannered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
