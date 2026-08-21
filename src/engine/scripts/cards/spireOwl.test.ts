// `Spire Owl` — the entry raises the orderCards ask; the answer's first
// card ends ON TOP.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIRE_OWL_SCRIPT } from './spireOwl';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function owled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Spire Owl'], []],
    scripts: createRegistry([SPIRE_OWL_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Spire Owl');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  if (revealed.length !== 4) throw new Error(`expected 4 revealed, got ${revealed.length}`);
  const reversed = [...revealed].reverse();
  must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: reversed }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  const after = g.state.zones.library['p1'] ?? [];
  if (after[after.length - 1] !== reversed[0]) throw new Error('first answered card must end on top');
  return g;
}

describe('Spire Owl', () => {
  test('the ask is answered and the chosen order holds', () => {
    const g = owled();
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = owled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
