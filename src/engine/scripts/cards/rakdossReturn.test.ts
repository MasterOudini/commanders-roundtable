// `Rakdos's Return` — X in damage, X in discards; a small hand goes
// whole and choicelessly.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAKDOSS_RETURN_SCRIPT } from './rakdossReturn';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function returned(x: number): Game {
  const g = startedGame({
    players: 2,
    decks: [["Rakdos's Return"], []],
    scripts: createRegistry([RAKDOSS_RETURN_SCRIPT]),
  });
  settle(g);
  const spell = put(g, 'p1', "Rakdos's Return", 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: x }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      xValue: x,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  return g;
}

describe("Rakdos's Return", () => {
  test('X=2 burns 2 and raises the discard ask at the TARGET', () => {
    const g = returned(2);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    expect(g.state.players['p2']?.life).toBe(38);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.player).toBe('p2');
    const hand = g.state.zones.hand['p2'] ?? [];
    const picks = hand.slice(0, 2) as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: picks }));
    settle(g);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(5);
  });

  test('X at hand size or more empties the hand with no ask', () => {
    const g = returned(9);
    settle(g);
    expect(g.state.players['p2']?.life).toBe(31);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(0);
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseFromZone');
  });

  test('replays to the same hash', () => {
    const g = returned(9);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
