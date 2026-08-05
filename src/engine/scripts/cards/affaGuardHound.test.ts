// `Affa Guard Hound` — the first script until-end-of-turn pump: +0/+3 through
// layer 7c, gone at cleanup with no help from the def.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AFFA_GUARD_HOUND_SCRIPT } from './affaGuardHound';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';

const HOUND = 'Affa Guard Hound';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[HOUND, 'Grizzly Bears'], []],
    scripts: createRegistry([AFFA_GUARD_HOUND_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Affa Guard Hound', () => {
  test('its entry gives the target +0/+3, and cleanup takes it back', () => {
    const g = game();
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const hound = put(g, 'p1', HOUND, 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: hound, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = deps(createRegistry([AFFA_GUARD_HOUND_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, bears).toughness).toBe(5);
    // The engine's own cleanup (CR 514.2) ends it — advance past the turn.
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(derive(g.state, d.oracle, d.scripts, bears).toughness).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const hound = put(g, 'p1', HOUND, 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: hound, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
