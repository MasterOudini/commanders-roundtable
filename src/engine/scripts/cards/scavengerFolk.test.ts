// `Scavenger Folk` — pays itself (with the tap) and the artifact dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCAVENGER_FOLK_SCRIPT } from './scavengerFolk';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scavenged(): { g: Game; folk: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Scavenger Folk'],
      ['Sol Ring'],
    ],
    scripts: createRegistry([SCAVENGER_FOLK_SCRIPT]),
  });
  const folk = put(g, 'p1', 'Scavenger Folk');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: folk,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: ring }],
    }),
  );
  settle(g);
  return { g, folk, ring };
}

describe('Scavenger Folk', () => {
  test('the Folk pay themselves and the artifact dies', () => {
    const { g, folk, ring } = scavenged();
    expect(g.state.cards[folk]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = scavenged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
