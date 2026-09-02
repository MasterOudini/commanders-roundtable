// `Anchovy & Banana Pizza` — the entry eats a creature (any creature); the
// Food line then trades the Pizza, tapped, for 3 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANCHOVY_BANANA_PIZZA_SCRIPT } from './anchovyBananaPizza';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PIZZA = 'Anchovy & Banana Pizza';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function served(): { g: Game; pizza: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PIZZA], [BEARS]],
    scripts: createRegistry([ANCHOVY_BANANA_PIZZA_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  const pizza = put(g, 'p1', PIZZA);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, pizza, theirs };
}

describe('Anchovy & Banana Pizza', () => {
  test('the entry destroys the targeted creature', () => {
    const { g, pizza, theirs } = served();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[pizza]?.zone.kind).toBe('battlefield');
  });

  test('{2}, {T}, sacrifice: 3 life, the Pizza gone', () => {
    const { g, pizza } = served();
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: pizza, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.cards[pizza]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = served();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
