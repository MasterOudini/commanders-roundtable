// `Phyresis Outbreak` — the poison lands first, so the debuff counts it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PHYRESIS_OUTBREAK_SCRIPT } from './phyresisOutbreak';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function outbreak(prePoison: number): { g: Game; theirs: string; mine: string } {
  const g = startedGame({
    players: 2,
    decks: [['Phyresis Outbreak', 'Grizzly Bears'], ['Colossal Dreadmaw']],
    scripts: createRegistry([PHYRESIS_OUTBREAK_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  if (prePoison > 0) {
    must(g.submit({ t: 'ManualSetPoison', player: 'p2', target: 'p2', delta: prePoison }));
  }
  const spell = put(g, 'p1', 'Phyresis Outbreak', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  for (const sym of ['B', 'C', 'C'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, theirs, mine };
}

describe('Phyresis Outbreak', () => {
  test('one poison in, minus-one-per-counter out — the new counter included', () => {
    const { g, theirs, mine } = outbreak(0);
    expect(g.state.players['p2']?.poison).toBe(1);
    const dread = derive(g.state, ORACLE, g.deps.scripts, theirs);
    expect(dread.power).toBe(5);
    expect(dread.toughness).toBe(5);
    const bears = derive(g.state, ORACLE, g.deps.scripts, mine);
    expect(bears.power).toBe(2);
  });

  test('existing poison deepens the debuff', () => {
    const { g, theirs } = outbreak(2);
    expect(g.state.players['p2']?.poison).toBe(3);
    const dread = derive(g.state, ORACLE, g.deps.scripts, theirs);
    expect(dread.power).toBe(3);
    expect(dread.toughness).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = outbreak(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
