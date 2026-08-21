// `Sage of Epityr` — the Sage Owl look on its third id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAGE_OF_EPITYR_SCRIPT } from './sageOfEpityr';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function saged(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Sage of Epityr'], []],
    scripts: createRegistry([SAGE_OF_EPITYR_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Sage of Epityr');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Sage of Epityr', () => {
  test('entering asks the four-card ordering to the top', () => {
    const { g, revealed } = saged();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('orderCards');
    expect(awaiting?.kind === 'orderCards' && awaiting.count).toBe(4);
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: revealed }));
    advanceUntil(g, (s) => (s.priority.awaiting ?? null) === null, 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(revealed[0]);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = saged();
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: revealed }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
