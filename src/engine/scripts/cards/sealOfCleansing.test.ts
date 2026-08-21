// `Seal of Cleansing` — cracks itself and the artifact dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEAL_OF_CLEANSING_SCRIPT } from './sealOfCleansing';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sealed(): { g: Game; seal: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seal of Cleansing'], ['Sol Ring']],
    scripts: createRegistry([SEAL_OF_CLEANSING_SCRIPT]),
  });
  const seal = put(g, 'p1', 'Seal of Cleansing');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: seal,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: ring }],
    }),
  );
  settle(g);
  return { g, seal, ring };
}

describe('Seal of Cleansing', () => {
  test('the Seal pays itself and the artifact dies', () => {
    const { g, seal, ring } = sealed();
    expect(g.state.cards[seal]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = sealed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
