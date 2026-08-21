// `Raucous Theater` — enters tapped, and the surveil sends the top card
// to the graveyard on a yes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAUCOUS_THEATER_SCRIPT } from './raucousTheater';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function staged(): { g: Game; theater: InstanceId; revealed: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Raucous Theater'], []],
    scripts: createRegistry([RAUCOUS_THEATER_SCRIPT]),
  });
  const theater = put(g, 'p1', 'Raucous Theater');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
  return { g, theater, revealed };
}

describe('Raucous Theater', () => {
  test('enters TAPPED; surveiling the card away puts it in the graveyard', () => {
    const { g, theater, revealed } = staged();
    expect(g.state.cards[theater]?.tapped).toBe(true);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    expect(g.state.cards[revealed]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = staged();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
