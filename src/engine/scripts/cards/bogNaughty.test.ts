// `Bog Naughty` — the Food predicate: a subtype that mostly lives on TOKENS
// pays the cost, and the -3/-3 kills a 2/2 through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOG_NAUGHTY_SCRIPT } from './bogNaughty';
import { FOOD_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const NAUGHTY = 'Bog Naughty';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; naughty: InstanceId; food: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[NAUGHTY], [BEARS]],
    scripts: createRegistry([BOG_NAUGHTY_SCRIPT]),
  });
  const naughty = put(g, 'p1', NAUGHTY);
  must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: FOOD_TOKEN.scryfallId, count: 1 }));
  const food = Object.keys(g.state.cards).find((id) => g.state.cards[id]?.isToken) as InstanceId;
  const bears = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, naughty, food, bears };
}

describe('Bog Naughty', () => {
  test('the Food pays, and -3/-3 kills the 2/2 through the SBA', () => {
    const { g, naughty, food, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: naughty, abilityIndex: 0, sacrifice: food }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    // The Food died paying and then CEASED (CR 704.5d) — a token in a
    // graveyard does not linger.
    expect(g.state.cards[food]).toBeUndefined();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[naughty]?.zone.kind).toBe('battlefield');
  });

  test('the Bog Naughty itself cannot pay a Food-only cost', () => {
    const { g, naughty } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: naughty, abilityIndex: 0, sacrifice: naughty });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, naughty, food, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: naughty, abilityIndex: 0, sacrifice: food }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
