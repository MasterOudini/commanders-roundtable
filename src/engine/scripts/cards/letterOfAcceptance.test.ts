// `Letter of Acceptance` — {2}, the tap and itself pay for the draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LETTER_OF_ACCEPTANCE_SCRIPT } from './letterOfAcceptance';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LETTER = 'Letter of Acceptance';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; letter: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LETTER], []],
    scripts: createRegistry([LETTER_OF_ACCEPTANCE_SCRIPT]),
  });
  const letter = put(g, 'p1', LETTER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, letter };
}

describe('Letter of Acceptance', () => {
  test('paying {2}, the tap and itself draws a card', () => {
    const { g, letter } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: letter, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[letter]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, letter } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: letter, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
