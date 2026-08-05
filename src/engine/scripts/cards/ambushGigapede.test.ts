// `Ambush Gigapede` — the negative pump: -2/-2 through layer 7c, and the
// state-based action does the killing when it is lethal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AMBUSH_GIGAPEDE_SCRIPT } from './ambushGigapede';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GIGAPEDE = 'Ambush Gigapede';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[GIGAPEDE], ['Grizzly Bears']],
    scripts: createRegistry([AMBUSH_GIGAPEDE_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Ambush Gigapede', () => {
  test("its entry gives an opponent's 2/2 -2/-2, and the SBA bins it", () => {
    const g = game();
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const pede = put(g, 'p1', GIGAPEDE, 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: pede, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    // ⚠️ The def only emits the modifier — lethality is layer 7c plus the
    // engine's own state-based action, the same division Scar proved in D130.
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const pede = put(g, 'p1', GIGAPEDE, 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: pede, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
