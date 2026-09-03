// `Tortured Existence` — black mana and a discarded CREATURE card trade one
// creature card in hand for one in the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TORTURED_EXISTENCE_SCRIPT } from './torturedExistence';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EXISTENCE = 'Tortured Existence';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';
const ISLAND = 'Island';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; existence: InstanceId; bearsInHand: InstanceId; islandInHand: InstanceId; hawkDead: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EXISTENCE, BEARS, NIGHTHAWK, ISLAND], []],
    scripts: createRegistry([TORTURED_EXISTENCE_SCRIPT]),
  });
  const existence = put(g, 'p1', EXISTENCE);
  const bearsInHand = put(g, 'p1', BEARS, 'hand');
  const islandInHand = put(g, 'p1', ISLAND, 'hand');
  const hawkDead = put(g, 'p1', NIGHTHAWK, 'graveyard');
  settle(g);
  return { g, existence, bearsInHand, islandInHand, hawkDead };
}

describe('Tortured Existence (typed discard-cost chooser)', () => {
  test('a creature card pays: the Nighthawk returns to my hand, the bear goes to the graveyard', () => {
    const { g, existence, bearsInHand, hawkDead } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: existence, abilityIndex: 0, discard: [bearsInHand] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawkDead }] }));
    settle(g);
    expect(g.state.cards[hawkDead]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[bearsInHand]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('a land card does not pay', () => {
    const { g, existence, islandInHand } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: existence, abilityIndex: 0, discard: [islandInHand] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, existence, bearsInHand, hawkDead } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: existence, abilityIndex: 0, discard: [bearsInHand] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawkDead }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
