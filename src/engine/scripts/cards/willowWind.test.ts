// `Willow-Wind` — flying plus an entry scry 2 (a bottomed card stays in the
// LIBRARY: scry, not surveil).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WILLOW_WIND_SCRIPT } from './willowWind';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WILLOW = 'Willow-Wind';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; willow: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[WILLOW], []],
    scripts: createRegistry([WILLOW_WIND_SCRIPT]),
  });
  const willow = put(g, 'p1', WILLOW);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, willow, revealed };
}

describe('Willow-Wind', () => {
  test('the entry asks a SCRY 2 — not a surveil', () => {
    const { g, revealed } = entered();
    expect(revealed).toHaveLength(2);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard,
    ).toBe(false);
  });

  test('a bottomed card stays in the library', () => {
    const { g, revealed } = entered();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('library');
    expect(g.state.zones.library['p1']?.[0]).toBe(a);
  });

  test('the Willow-Wind flies', () => {
    const { g, willow, revealed } = entered();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a, b], toBottom: [] }));
    settle(g);
    const d = deps(createRegistry([WILLOW_WIND_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, willow).keywords.has('flying')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a, b], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
