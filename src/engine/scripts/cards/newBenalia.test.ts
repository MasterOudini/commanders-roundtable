// `New Benalia` — tapped entry, then the scry 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEW_BENALIA_SCRIPT } from './newBenalia';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function benaliad(): { g: Game; land: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['New Benalia'], []],
    scripts: createRegistry([NEW_BENALIA_SCRIPT]),
  });
  settle(g);
  const land = put(g, 'p1', 'New Benalia');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, land, revealed };
}

describe('New Benalia', () => {
  test('enters TAPPED and asks a scry that BOTTOMS', () => {
    const { g, land, revealed } = benaliad();
    expect(g.state.cards[land]?.tapped).toBe(true);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect((g.state.zones.library['p1'] ?? [])[0]).toBe(revealed[0]);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = benaliad();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
