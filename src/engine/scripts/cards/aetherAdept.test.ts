// `Aether Adept` — the first script bounce: the target goes to its OWNER's
// hand, wherever it was controlled.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AETHER_ADEPT_SCRIPT } from './aetherAdept';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ADEPT = 'Aether Adept';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [
      [ADEPT],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([AETHER_ADEPT_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Aether Adept', () => {
  test("its entry bounces the target to its OWNER's hand", () => {
    const g = game();
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const handBefore = idsIn(g, 'p2', 'hand').length;
    const adept = put(g, 'p1', ADEPT, 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: adept, to: { kind: 'battlefield', player: 'p1' } }));
    // CR 603.3d — the prompt is up in the same pass the ability stacked in.
    // Answered DIRECTLY, never through advanceUntil, which would auto-answer
    // it with the minimum legal pick (possibly the Adept itself).
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(idsIn(g, 'p2', 'hand').length).toBe(handBefore + 1);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const adept = put(g, 'p1', ADEPT, 'graveyard');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: adept, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
