// `Sage Owl` — entering asks the ordering, and the first card of the
// answer ends on top.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAGE_OWL_SCRIPT } from './sageOwl';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function owled(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Sage Owl'], []],
    scripts: createRegistry([SAGE_OWL_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Sage Owl');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Sage Owl', () => {
  test('the ask covers four to the top, and the answer decides the order', () => {
    const { g, revealed } = owled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('orderCards');
    expect(awaiting?.kind === 'orderCards' && awaiting.count).toBe(4);
    expect(awaiting?.kind === 'orderCards' && awaiting.destination).toBe('top');
    expect(revealed).toHaveLength(4);
    // revealed sits in library order, so its first entry is NOT the top —
    // answering with it first is a real reorder.
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: revealed }));
    advanceUntil(g, (s) => (s.priority.awaiting ?? null) === null, 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(revealed[0]);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = owled();
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: revealed }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
