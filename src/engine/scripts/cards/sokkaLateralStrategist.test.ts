// `Sokka, Lateral Strategist` — attacking WITH an ally draws; attacking
// alone does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOKKA_LATERAL_STRATEGIST_SCRIPT } from './sokkaLateralStrategist';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(withAlly: boolean): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Sokka, Lateral Strategist', 'Grizzly Bears'], []],
    scripts: createRegistry([SOKKA_LATERAL_STRATEGIST_SCRIPT]),
  });
  const sokka = put(g, 'p1', 'Sokka, Lateral Strategist');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  const before = (g.state.zones.hand['p1'] ?? []).length;
  const attackers = withAlly
    ? [
        { card: sokka, defender: { kind: 'player', id: 'p2' } as const },
        { card: bears, defender: { kind: 'player', id: 'p2' } as const },
      ]
    : [{ card: sokka, defender: { kind: 'player', id: 'p2' } as const }];
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers }));
  settle(g);
  return { g, before };
}

describe('Sokka, Lateral Strategist', () => {
  test('attacking with an ally draws a card', () => {
    const { g, before } = attacked(true);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('attacking alone draws nothing', () => {
    const { g, before } = attacked(false);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('replays to the same hash', () => {
    const { g } = attacked(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
