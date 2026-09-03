// `Kyren Negotiations` — tapping my untapped creature deals 1 to the
// opponent; two creatures are two activations in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KYREN_NEGOTIATIONS_SCRIPT } from './kyrenNegotiations';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KYREN = 'Kyren Negotiations';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; kyren: InstanceId; a: InstanceId; b: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KYREN, BEARS, NIGHTHAWK], []],
    scripts: createRegistry([KYREN_NEGOTIATIONS_SCRIPT]),
  });
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', NIGHTHAWK);
  const kyren = put(g, 'p1', KYREN);
  settle(g);
  return { g, kyren, a, b };
}

describe('Kyren Negotiations', () => {
  test('one creature tapped: 1 damage to the opponent', () => {
    const { g, kyren, a } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kyren, abilityIndex: 0, tap: [a] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[a]?.tapped).toBe(true);
  });

  test('two creatures: two activations, 2 damage', () => {
    const { g, kyren, a, b } = placed();
    for (const c of [a, b]) {
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kyren, abilityIndex: 0, tap: [c] }));
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
      settle(g);
    }
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g, kyren, a } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kyren, abilityIndex: 0, tap: [a] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
