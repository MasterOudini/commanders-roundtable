// `Archaeomancer` — a targeted ETB graveyard return restricted to instant or
// sorcery CARDS (D138's cardTypes at work on a trigger).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARCHAEOMANCER_SCRIPT } from './archaeomancer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MANCER = 'Archaeomancer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Archaeomancer', () => {
  test('returns an instant from the graveyard to hand', () => {
    const g = startedGame({
      players: 2,
      decks: [[MANCER, 'Lightning Bolt'], []],
      scripts: createRegistry([ARCHAEOMANCER_SCRIPT]),
    });
    const bolt = put(g, 'p1', 'Lightning Bolt', 'graveyard');
    settle(g);
    const mancer = put(g, 'p1', MANCER, 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mancer, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }));
    settle(g);
    expect(g.state.cards[bolt]?.zone.kind).toBe('hand');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
