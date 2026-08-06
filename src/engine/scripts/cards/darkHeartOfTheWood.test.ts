// `Dark Heart of the Wood` — the Forest predicate: a Forest pays the
// mana-free cost, a nameless land does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DARK_HEART_OF_THE_WOOD_SCRIPT } from './darkHeartOfTheWood';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DARK_HEART = 'Dark Heart of the Wood';
const FOREST = 'Forest';
const FOUNTAIN = 'Radiant Fountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; heart: InstanceId; forest: InstanceId; fountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DARK_HEART, FOREST, FOUNTAIN], []],
    scripts: createRegistry([DARK_HEART_OF_THE_WOOD_SCRIPT]),
  });
  const heart = put(g, 'p1', DARK_HEART);
  const forest = put(g, 'p1', FOREST);
  const fountain = put(g, 'p1', FOUNTAIN);
  settle(g);
  return { g, heart, forest, fountain };
}

describe('Dark Heart of the Wood', () => {
  test('a Forest pays the mana-free cost and the life arrives', () => {
    const { g, heart, forest } = game();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: heart, abilityIndex: 0, sacrifice: forest }));
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 3);
  });

  test('a land that is not a Forest cannot pay', () => {
    const { g, heart, fountain } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: heart, abilityIndex: 0, sacrifice: fountain });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, heart, forest } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: heart, abilityIndex: 0, sacrifice: forest }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
