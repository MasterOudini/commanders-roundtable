// `Temporal Adept` — the bounce aimed at any PERMANENT: a creature and a
// LAND are both legal answers, which is the point of the noun.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEMPORAL_ADEPT_SCRIPT } from './temporalAdept';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ADEPT = 'Temporal Adept';
const BEARS = 'Grizzly Bears';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bounced(which: 'creature' | 'land'): { g: Game; bears: InstanceId; forest: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ADEPT, FOREST], [BEARS]],
    scripts: createRegistry([TEMPORAL_ADEPT_SCRIPT]),
  });
  const adept = put(g, 'p1', ADEPT);
  const forest = put(g, 'p1', FOREST);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  // The {T} needs the Adept past summoning sickness (CR 302.6).
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    40_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: adept, abilityIndex: 0 }));
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: which === 'creature' ? bears : forest }],
    }),
  );
  settle(g);
  return { g, bears, forest };
}

describe('Temporal Adept', () => {
  test("an opponent's creature goes back to THEIR hand", () => {
    const { g, bears } = bounced('creature');
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[bears]?.zone.player).toBe('p2');
  });

  test('a LAND is a legal answer too — the noun is "permanent"', () => {
    const { g, forest } = bounced('land');
    expect(g.state.cards[forest]?.zone.kind).toBe('hand');
    expect(g.state.cards[forest]?.zone.player).toBe('p1');
  });

  test('replays to the same hash', () => {
    const { g } = bounced('creature');
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
