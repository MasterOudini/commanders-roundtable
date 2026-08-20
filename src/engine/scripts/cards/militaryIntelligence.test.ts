// `Military Intelligence` — two attackers draw; one draws nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MILITARY_INTELLIGENCE_SCRIPT } from './militaryIntelligence';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function briefed(two: boolean): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Military Intelligence', 'Grizzly Bears', 'Aysen Bureaucrats'], []],
    scripts: createRegistry([MILITARY_INTELLIGENCE_SCRIPT]),
  });
  put(g, 'p1', 'Military Intelligence');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const clerk = put(g, 'p1', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  const attackers = two
    ? [
        { card: bears, defender: { kind: 'player' as const, id: 'p2' } },
        { card: clerk, defender: { kind: 'player' as const, id: 'p2' } },
      ]
    : [{ card: bears, defender: { kind: 'player' as const, id: 'p2' } }];
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers }));
  settle(g);
  return { g, mid };
}

describe('Military Intelligence', () => {
  test('two attackers draw a card', () => {
    const { g, mid } = briefed(true);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('a lone attacker draws nothing', () => {
    const { g, mid } = briefed(false);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid);
  });

  test('replays to the same hash', () => {
    const { g } = briefed(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
