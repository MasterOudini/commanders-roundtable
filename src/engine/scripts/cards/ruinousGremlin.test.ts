// `Ruinous Gremlin` — pays itself and the artifact dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RUINOUS_GREMLIN_SCRIPT } from './ruinousGremlin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gremlind(): { g: Game; gremlin: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Ruinous Gremlin'],
      ['Sol Ring'],
    ],
    scripts: createRegistry([RUINOUS_GREMLIN_SCRIPT]),
  });
  const gremlin = put(g, 'p1', 'Ruinous Gremlin');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: gremlin,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: ring }],
    }),
  );
  settle(g);
  return { g, gremlin, ring };
}

describe('Ruinous Gremlin', () => {
  test('the Gremlin pays itself and the artifact dies', () => {
    const { g, gremlin, ring } = gremlind();
    expect(g.state.cards[gremlin]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = gremlind();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
