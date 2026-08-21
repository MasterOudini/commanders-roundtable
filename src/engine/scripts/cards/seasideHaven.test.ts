// `Seaside Haven` — a Bird pays and the draw arrives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEASIDE_HAVEN_SCRIPT } from './seasideHaven';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function havened(): { g: Game; mid: number; owl: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seaside Haven', 'Sage Owl'], []],
    scripts: createRegistry([SEASIDE_HAVEN_SCRIPT]),
  });
  const haven = put(g, 'p1', 'Seaside Haven');
  const owl = put(g, 'p1', 'Sage Owl');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: haven,
      abilityIndex: 1,
      sacrifice: owl,
    }),
  );
  settle(g);
  return { g, mid, owl };
}

describe('Seaside Haven', () => {
  test('the Bird pays and the draw arrives', () => {
    const { g, mid, owl } = havened();
    expect(g.state.cards[owl]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g } = havened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
