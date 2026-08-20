// `Pixie Queen` — three green and a tap put a Bears in the air until
// cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PIXIE_QUEEN_SCRIPT } from './pixieQueen';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function crowned(): { g: Game; bears: InstanceId; turn: number } {
  const g = startedGame({
    players: 2,
    decks: [['Pixie Queen', 'Grizzly Bears'], []],
    scripts: createRegistry([PIXIE_QUEEN_SCRIPT]),
  });
  const queen = put(g, 'p1', 'Pixie Queen');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: queen,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, bears, turn: g.state.turn.turnNumber };
}

describe('Pixie Queen', () => {
  test('the Bears flies until end of turn and lands at cleanup', () => {
    const { g, bears, turn } = crowned();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, turn } = crowned();
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
