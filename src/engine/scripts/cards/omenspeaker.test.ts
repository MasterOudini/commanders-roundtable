// `Omenspeaker` — the Octoprophet text on its own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OMENSPEAKER_SCRIPT } from './omenspeaker';
import { OMENSPEAKER, OCTOPROPHET } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spoken(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Omenspeaker'], []],
    scripts: createRegistry([OMENSPEAKER_SCRIPT]),
  });
  settle(g);
  put(g, 'p1', 'Omenspeaker');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Omenspeaker', () => {
  test('carries the family text verbatim', () => {
    expect(OMENSPEAKER.faces[0]?.oracleText).toBe(OCTOPROPHET.faces[0]?.oracleText);
  });

  test('the entry asks a scry 2', () => {
    const { g, revealed } = spoken();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = spoken();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
