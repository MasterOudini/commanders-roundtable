// `Deadeye Duelist` — the opponent-only ping past sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEADEYE_DUELIST_SCRIPT } from './deadeyeDuelist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DUELIST = 'Deadeye Duelist';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; duelist: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DUELIST], []],
    scripts: createRegistry([DEADEYE_DUELIST_SCRIPT]),
  });
  const duelist = put(g, 'p1', DUELIST);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, duelist };
}

describe('Deadeye Duelist', () => {
  test('taps, aims at the opponent, deals 1', () => {
    const { g, duelist } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: duelist, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[duelist]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, duelist } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: duelist, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
