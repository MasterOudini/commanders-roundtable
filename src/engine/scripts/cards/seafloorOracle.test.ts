// `Seafloor Oracle` — TWO Merfolk connecting draw TWO: the perItem
// proof; a non-Merfolk connect draws nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEAFLOOR_ORACLE_SCRIPT } from './seafloorOracle';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function oracled(attackers: readonly string[]): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Seafloor Oracle', 'Rootwater Hunter', 'Rootwater Hunter', 'Grizzly Bears'],
      [],
    ],
    scripts: createRegistry([SEAFLOOR_ORACLE_SCRIPT]),
  });
  put(g, 'p1', 'Seafloor Oracle');
  const ids = attackers.map((name) => put(g, 'p1', name));
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: ids.map((card) => ({ card, defender: { kind: 'player' as const, id: 'p2' } })),
    }),
  );
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 120_000);
  settle(g);
  return { g, mid };
}

describe('Seafloor Oracle', () => {
  test('two Merfolk connecting draw two — one per item', () => {
    const { g, mid } = oracled(['Rootwater Hunter', 'Rootwater Hunter']);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('a non-Merfolk connect draws nothing', () => {
    const { g, mid } = oracled(['Grizzly Bears']);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid);
  });

  test('replays to the same hash', () => {
    const { g } = oracled(['Rootwater Hunter']);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
