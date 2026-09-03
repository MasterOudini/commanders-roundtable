// `Aphetto Grifter` — two untapped Wizards (itself and Azami) tap to tap the
// opponent's permanent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { APHETTO_GRIFTER_SCRIPT } from './aphettoGrifter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GRIFTER = 'Aphetto Grifter';
const AZAMI = 'Azami, Lady of Scrolls';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; grifter: InstanceId; azami: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GRIFTER, AZAMI], [BEARS]],
    scripts: createRegistry([APHETTO_GRIFTER_SCRIPT]),
  });
  const azami = put(g, 'p1', AZAMI);
  const theirs = put(g, 'p2', BEARS);
  const grifter = put(g, 'p1', GRIFTER);
  settle(g);
  return { g, grifter, azami, theirs };
}

describe('Aphetto Grifter (tap two Wizards)', () => {
  test('the Grifter and Azami tap to tap their bear', () => {
    const { g, grifter, azami, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: grifter, abilityIndex: 0, tap: [grifter, azami] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[grifter]?.tapped).toBe(true);
    expect(g.state.cards[azami]?.tapped).toBe(true);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, grifter, azami, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: grifter, abilityIndex: 0, tap: [grifter, azami] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
