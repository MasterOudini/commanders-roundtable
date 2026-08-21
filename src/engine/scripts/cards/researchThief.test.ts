// `Research Thief` — an artifact creature connecting draws; a plain
// creature connecting does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RESEARCH_THIEF_SCRIPT } from './researchThief';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function heisted(attackerName: string): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [['Research Thief', 'Peace Strider', 'Grizzly Bears'], []],
    scripts: createRegistry([RESEARCH_THIEF_SCRIPT]),
  });
  put(g, 'p1', 'Research Thief');
  const attacker = put(g, 'p1', attackerName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  const logAt = g.log.length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain', 60_000);
  settle(g);
  const drew = g.log
    .slice(logAt)
    .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
    .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
  return { g, drew };
}

describe('Research Thief', () => {
  test('a Peace Strider connecting draws one', () => {
    const { drew } = heisted('Peace Strider');
    expect(drew).toBe(1);
  });

  test('a Grizzly Bears connecting draws nothing', () => {
    const { drew } = heisted('Grizzly Bears');
    expect(drew).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = heisted('Peace Strider');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
