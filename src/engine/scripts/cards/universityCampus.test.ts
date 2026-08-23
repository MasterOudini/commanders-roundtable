// `University Campus` — the activated surveil behind a tapped entry: it must
// be straightened before its own {T} can be paid.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNIVERSITY_CAMPUS_SCRIPT } from './universityCampus';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CAMPUS = 'University Campus';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function surveiled(): { g: Game; campus: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[CAMPUS], []],
    scripts: createRegistry([UNIVERSITY_CAMPUS_SCRIPT]),
  });
  const campus = put(g, 'p1', CAMPUS);
  settle(g);
  expect(g.state.cards[campus]?.tapped).toBe(true);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [campus], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: campus, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  return { g, campus, revealed: lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) };
}

describe('University Campus', () => {
  test('#a1 surveils, and the land is turned again to pay for it', () => {
    const { g, campus, revealed } = surveiled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [card] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[campus]?.tapped).toBe(true);
    expect(g.state.cards[campus]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = surveiled();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
