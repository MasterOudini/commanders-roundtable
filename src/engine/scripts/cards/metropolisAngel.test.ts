// `Metropolis Angel` — a countered attacker draws; a bare one does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { METROPOLIS_ANGEL_SCRIPT } from './metropolisAngel';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function angeled(withCounter: boolean): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Metropolis Angel', 'Grizzly Bears'], []],
    scripts: createRegistry([METROPOLIS_ANGEL_SCRIPT]),
  });
  put(g, 'p1', 'Metropolis Angel');
  const bears = put(g, 'p1', 'Grizzly Bears');
  if (withCounter) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
  }
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  // Measured HERE — after the walk to combat, so the turn's own draw step
  // is behind us and the only draw left to see is the trigger's.
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return { g, mid };
}

describe('Metropolis Angel', () => {
  test('attacking with a countered creature draws', () => {
    const { g, mid } = angeled(true);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('a counterless attack draws nothing', () => {
    const { g, mid } = angeled(false);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid);
  });

  test('replays to the same hash', () => {
    const { g } = angeled(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
