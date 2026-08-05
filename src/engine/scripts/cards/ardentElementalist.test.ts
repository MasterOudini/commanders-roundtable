// `Ardent Elementalist` — Archaeomancer's twin; the deep case lives there.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARDENT_ELEMENTALIST_SCRIPT } from './ardentElementalist';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Ardent Elementalist', () => {
  test('returns an instant and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Ardent Elementalist', 'Lightning Bolt'], []],
      scripts: createRegistry([ARDENT_ELEMENTALIST_SCRIPT]),
    });
    const bolt = put(g, 'p1', 'Lightning Bolt', 'graveyard');
    settle(g);
    const it = put(g, 'p1', 'Ardent Elementalist', 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: it, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }));
    settle(g);
    expect(g.state.cards[bolt]?.zone.kind).toBe('hand');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
