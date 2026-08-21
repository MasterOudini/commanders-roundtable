// `Soulreaper of Mogis` — the Bears pays the enchantment creature's draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULREAPER_OF_MOGIS_SCRIPT } from './soulreaperOfMogis';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reaped(): { g: Game; bears: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Soulreaper of Mogis', 'Grizzly Bears'], []],
    scripts: createRegistry([SOULREAPER_OF_MOGIS_SCRIPT]),
  });
  const reaper = put(g, 'p1', 'Soulreaper of Mogis');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: reaper,
      abilityIndex: 0,
      sacrifice: bears,
    }),
  );
  settle(g);
  return { g, bears, before };
}

describe('Soulreaper of Mogis', () => {
  test('the Bears pays and the draw arrives', () => {
    const { g, bears, before } = reaped();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = reaped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
