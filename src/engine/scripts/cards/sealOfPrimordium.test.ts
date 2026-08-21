// `Seal of Primordium` — the green Seal cracks itself; an enchantment is
// a legal target too.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEAL_OF_PRIMORDIUM_SCRIPT } from './sealOfPrimordium';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sealed(): { g: Game; seal: InstanceId; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seal of Primordium'], ['Captive Flame']],
    scripts: createRegistry([SEAL_OF_PRIMORDIUM_SCRIPT]),
  });
  const seal = put(g, 'p1', 'Seal of Primordium');
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: seal,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: flame }],
    }),
  );
  settle(g);
  return { g, seal, flame };
}

describe('Seal of Primordium', () => {
  test('the Seal pays itself and the enchantment dies', () => {
    const { g, seal, flame } = sealed();
    expect(g.state.cards[seal]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = sealed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
