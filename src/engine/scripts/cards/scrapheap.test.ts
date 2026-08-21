// `Scrapheap` — an artifact dying pays 1, a creature pays nothing, and a
// WIPE pays once per item — the Scrapheap counting its own corpse.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCRAPHEAP_SCRIPT } from './scrapheap';
import { RUINOUS_ULTIMATUM_SCRIPT } from './ruinousUltimatum';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function heaped(): { g: Game; a: InstanceId; b: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Scrapheap', 'Sol Ring', 'Sol Ring', 'Grizzly Bears'],
      ['Ruinous Ultimatum'],
    ],
    scripts: createRegistry([SCRAPHEAP_SCRIPT, RUINOUS_ULTIMATUM_SCRIPT]),
  });
  put(g, 'p1', 'Scrapheap');
  const a = put(g, 'p1', 'Sol Ring');
  const b = put(g, 'p1', 'Sol Ring');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  return { g, a, b, bears };
}

function kill(g: Game, card: InstanceId): void {
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
}

describe('Scrapheap', () => {
  test('an artifact pays 1; a creature pays nothing', () => {
    const { g, a, bears } = heaped();
    kill(g, bears);
    expect(g.state.players['p1']?.life).toBe(40);
    kill(g, a);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test("the opponent's wipe pays once per item — the Scrapheap counts its own corpse", () => {
    const { g } = heaped();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 120_000);
    const spell = put(g, 'p2', 'Ruinous Ultimatum', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'W', amount: 3 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
    settle(g);
    // Both Sol Rings AND the Scrapheap die in the ONE batch (the Bears too,
    // but a creature pays nothing): three firings, +3.
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const { g, a } = heaped();
    kill(g, a);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
