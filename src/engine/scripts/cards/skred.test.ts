// `Skred` — the damage IS the snow census: two Snow-Covered Swamps kill a
// 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKRED_SCRIPT } from './skred';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function skredded(snowCount: number): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Skred', 'Snow-Covered Swamp', 'Snow-Covered Swamp'], ['Grizzly Bears']],
    scripts: createRegistry([SKRED_SCRIPT]),
  });
  for (let i = 0; i < snowCount; i++) put(g, 'p1', 'Snow-Covered Swamp');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Skred', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Skred', () => {
  test('two snow permanents kill the 2/2', () => {
    const { g, bears } = skredded(2);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('one snow permanent only wounds it', () => {
    const { g, bears } = skredded(1);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = skredded(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
