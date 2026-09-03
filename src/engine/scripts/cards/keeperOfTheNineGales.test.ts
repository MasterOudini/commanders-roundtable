// `Keeper of the Nine Gales` — its own tap and two untapped Birds tapped
// (itself and Aven Fateshaper) return the opponent's permanent to hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KEEPER_OF_THE_NINE_GALES_SCRIPT } from './keeperOfTheNineGales';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KEEPER = 'Keeper of the Nine Gales';
const AVEN = 'Aven Fateshaper';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; keeper: InstanceId; aven: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KEEPER, AVEN], [BEARS]],
    scripts: createRegistry([KEEPER_OF_THE_NINE_GALES_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const aven = put(g, 'p1', AVEN);
  const keeper = put(g, 'p1', KEEPER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, keeper, aven, theirs };
}

describe('Keeper of the Nine Gales (tap two Birds)', () => {
  test('the Keeper taps for itself and as a Bird beside the Aven; their bear returns to hand', () => {
    const { g, keeper, aven, theirs } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0, tap: [keeper, aven] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[aven]?.tapped).toBe(true);
    expect(g.state.cards[keeper]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, keeper, aven, theirs } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0, tap: [keeper, aven] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
