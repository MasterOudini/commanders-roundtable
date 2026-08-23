// `Titan's Grave` — the activated surveil behind a TAPPED entry, so the land
// has to be straightened before the {T} in its own cost can be paid.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TITANS_GRAVE_SCRIPT } from './titansGrave';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GRAVE = "Titan's Grave";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function surveiled(): { g: Game; grave: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[GRAVE], []],
    scripts: createRegistry([TITANS_GRAVE_SCRIPT]),
  });
  const grave = put(g, 'p1', GRAVE);
  settle(g);
  // ⚠️ D134's built-in turned it on the way in, so the {T} is unpayable
  // until it is straightened by hand.
  expect(g.state.cards[grave]?.tapped).toBe(true);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [grave], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: grave, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  return { g, grave, revealed: lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) };
}

describe("Titan's Grave", () => {
  test('the ability is #a1 — the mana line is ability 0 — and it surveils', () => {
    const { g, grave, revealed } = surveiled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [card] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    // The {T} was paid, so the land is turned again — and it survives.
    expect(g.state.cards[grave]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[grave]?.tapped).toBe(true);
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
