// `Agents of HYDRA` — a dies trigger creating a token: the look-back and the
// resolver in one card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AGENTS_OF_HYDRA_SCRIPT } from './agentsOfHydra';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const AGENTS = 'Agents of HYDRA';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[AGENTS], []],
    scripts: createRegistry([AGENTS_OF_HYDRA_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Agents of HYDRA', () => {
  test('dying leaves a real 2/1 Villain behind; a bounce leaves nothing', () => {
    const g = game();
    const id = put(g, 'p1', AGENTS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((v) => nameOf(g, v) === 'Villain')).toHaveLength(1);
    // Back for the negative: return it and BOUNCE it — no second Villain.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((v) => nameOf(g, v) === 'Villain')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', AGENTS);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
