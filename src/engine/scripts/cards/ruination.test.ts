// `Ruination` — the nonbasic dies, the basic lives, and the
// indestructible nonbasic survives its own clause.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RUINATION_SCRIPT } from './ruination';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ruined(): { g: Game; port: InstanceId; basic: InstanceId; citadel: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Ruination', 'Darksteel Citadel'],
      ['Rishadan Port', 'Mountain'],
    ],
    scripts: createRegistry([RUINATION_SCRIPT]),
  });
  const citadel = put(g, 'p1', 'Darksteel Citadel');
  const port = put(g, 'p2', 'Rishadan Port');
  const basic = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Ruination', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, port, basic, citadel };
}

describe('Ruination', () => {
  test('the nonbasic dies; the basic and the indestructible stand', () => {
    const { g, port, basic, citadel } = ruined();
    expect(g.state.cards[port]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[basic]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = ruined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
