// `Tocasia's Dig Site` — Titan's Grave's ability behind a different first
// line: no tapped entry, so the land can pay its own {T} the moment it can
// act, and the def is still #a1 of a TWO-line card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TOCASIAS_DIG_SITE_SCRIPT } from './tocasiasDigSite';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SITE = "Tocasia's Dig Site";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function surveiled(): { g: Game; site: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[SITE], []],
    scripts: createRegistry([TOCASIAS_DIG_SITE_SCRIPT]),
  });
  const site = put(g, 'p1', SITE);
  settle(g);
  expect(g.state.cards[site]?.tapped).toBe(false);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: site, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  return { g, site, revealed: lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) };
}

describe("Tocasia's Dig Site", () => {
  test('it enters UNTAPPED and surveils for {3} and its own tap', () => {
    const { g, site, revealed } = surveiled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [card] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[site]?.tapped).toBe(true);
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
