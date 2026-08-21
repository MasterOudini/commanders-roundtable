// `Resolute Watchdog` — trades itself for a turn of indestructible.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RESOLUTE_WATCHDOG_SCRIPT } from './resoluteWatchdog';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function guarded(): { g: Game; dog: InstanceId; bears: InstanceId; turn: number } {
  const g = startedGame({
    players: 2,
    decks: [['Resolute Watchdog', 'Grizzly Bears'], []],
    scripts: createRegistry([RESOLUTE_WATCHDOG_SCRIPT]),
  });
  const dog = put(g, 'p1', 'Resolute Watchdog');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: dog,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, dog, bears, turn: g.state.turn.turnNumber };
}

describe('Resolute Watchdog', () => {
  test('the dog dies paying and the Bears is indestructible until cleanup', () => {
    const { g, dog, bears, turn } = guarded();
    expect(g.state.cards[dog]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('indestructible')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('indestructible')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, turn } = guarded();
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
