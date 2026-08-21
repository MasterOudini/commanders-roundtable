// `Seal of Removal` — cracks itself and the creature goes home.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEAL_OF_REMOVAL_SCRIPT } from './sealOfRemoval';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sealed(): { g: Game; seal: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seal of Removal'], ['Grizzly Bears']],
    scripts: createRegistry([SEAL_OF_REMOVAL_SCRIPT]),
  });
  const seal = put(g, 'p1', 'Seal of Removal');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: seal,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, seal, bears };
}

describe('Seal of Removal', () => {
  test('the Seal pays itself and the creature goes to hand', () => {
    const { g, seal, bears } = sealed();
    expect(g.state.cards[seal]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
  });

  test('replays to the same hash', () => {
    const { g } = sealed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
