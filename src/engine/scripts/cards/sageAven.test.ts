// `Sage Aven` — the Sage Owl look on its second id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAGE_AVEN_SCRIPT } from './sageAven';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function avened(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Sage Aven'], []],
    scripts: createRegistry([SAGE_AVEN_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Sage Aven');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Sage Aven', () => {
  test('entering asks the four-card ordering to the top', () => {
    const { g, revealed } = avened();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('orderCards');
    expect(awaiting?.kind === 'orderCards' && awaiting.count).toBe(4);
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: revealed }));
    advanceUntil(g, (s) => (s.priority.awaiting ?? null) === null, 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(revealed[0]);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = avened();
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: revealed }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
