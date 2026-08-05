// `Abzan Banner` — Hedron Archive's shape with a colored cost; the deep cases
// live in hedronArchive.test.ts.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ABZAN_BANNER_SCRIPT } from './abzanBanner';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BANNER = 'Abzan Banner';

function game(): Game {
  return startedGame({ players: 2, decks: [[BANNER], []], scripts: createRegistry([ABZAN_BANNER_SCRIPT]) });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Abzan Banner', () => {
  test('sacrifices itself for a card', () => {
    const g = game();
    const id = put(g, 'p1', BANNER);
    settle(g);
    for (const symbol of ['W', 'B', 'G'] as const) {
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 1 }));
    }
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', BANNER);
    settle(g);
    for (const symbol of ['W', 'B', 'G'] as const) {
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 1 }));
    }
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
