// `Wall of Runes` — defender plus an entry scry 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WALL_OF_RUNES_SCRIPT } from './wallOfRunes';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WALL = 'Wall of Runes';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; wall: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[WALL], []],
    scripts: createRegistry([WALL_OF_RUNES_SCRIPT]),
  });
  const wall = put(g, 'p1', WALL);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, wall, revealed };
}

describe('Wall of Runes', () => {
  test('the entry asks a scry 1', () => {
    const { g, revealed } = entered();
    expect(revealed).toHaveLength(1);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.count,
    ).toBe(1);
  });

  test('a bottomed card goes to the bottom of the LIBRARY', () => {
    const { g, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
    settle(g);
    expect(g.state.cards[top]?.zone.kind).toBe('library');
    expect(g.state.zones.library['p1']?.[0]).toBe(top);
  });

  test('the Wall defends', () => {
    const { g, wall, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    const d = deps(createRegistry([WALL_OF_RUNES_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, wall).keywords.has('defender')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
