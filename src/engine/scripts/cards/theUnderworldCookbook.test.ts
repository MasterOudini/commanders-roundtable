// `The Underworld Cookbook` — the tap and a discarded card cook a Food;
// five mana, the tap and the Book itself return a creature card from my
// graveyard to my hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THE_UNDERWORLD_COOKBOOK_SCRIPT } from './theUnderworldCookbook';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const COOKBOOK = 'The Underworld Cookbook';
const BEARS = 'Grizzly Bears';
const FOOD = TOKEN_TABLE['Food|/||Artifact|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function foods(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === FOOD?.printingId;
  }).length;
}

function placed(): { g: Game; book: InstanceId; dead: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[COOKBOOK, BEARS], []],
    scripts: createRegistry([THE_UNDERWORLD_COOKBOOK_SCRIPT]),
  });
  const dead = put(g, 'p1', BEARS, 'graveyard');
  const book = put(g, 'p1', COOKBOOK);
  settle(g);
  return { g, book, dead };
}

describe('The Underworld Cookbook', () => {
  test('{T}, discard a card: a Food', () => {
    const { g, book } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: book, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(foods(g, 'p1')).toBe(1);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
  });

  test('{4}, {T}, sacrifice: the bear returns from my graveyard to my hand', () => {
    const { g, book, dead } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: book, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
    settle(g);
    expect(g.state.cards[dead]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[book]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, book } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: book, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
