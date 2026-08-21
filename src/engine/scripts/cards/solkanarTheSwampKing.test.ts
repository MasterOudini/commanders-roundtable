// `Sol'kanar the Swamp King` — a black cast pays 1; a white cast pays
// nothing. Both spells are batch-mates.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOLKANAR_THE_SWAMP_KING_SCRIPT } from './solkanarTheSwampKing';
import { SMOTHER_SCRIPT } from './smother';
import { SOOTHING_BALM_SCRIPT } from './soothingBalm';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reigned(): Game {
  const g = startedGame({
    players: 2,
    decks: [["Sol'kanar the Swamp King", 'Smother', 'Soothing Balm'], ['Grizzly Bears']],
    scripts: createRegistry([SOLKANAR_THE_SWAMP_KING_SCRIPT, SMOTHER_SCRIPT, SOOTHING_BALM_SCRIPT]),
  });
  put(g, 'p1', "Sol'kanar the Swamp King");
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // The BLACK cast pays 1: 40 -> 41.
  const smother = put(g, 'p1', 'Smother', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: smother }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  if (g.state.players['p1']?.life !== 41) throw new Error('the black cast must pay 1');
  // The WHITE cast pays nothing beyond its own 5: 41 -> 46, not 47.
  const balm = put(g, 'p1', 'Soothing Balm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: balm }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }));
  settle(g);
  return g;
}

describe("Sol'kanar the Swamp King", () => {
  test('black casts pay 1; white casts pay nothing', () => {
    const g = reigned();
    expect(g.state.players['p1']?.life).toBe(46);
  });

  test('replays to the same hash', () => {
    const g = reigned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
