// `Wakandan Drone Flock` — flying plus a scry 2 on the entry; a bottomed card
// stays in the LIBRARY (scry, not surveil).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WAKANDAN_DRONE_FLOCK_SCRIPT } from './wakandanDroneFlock';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FLOCK = 'Wakandan Drone Flock';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; flock: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[FLOCK], []],
    scripts: createRegistry([WAKANDAN_DRONE_FLOCK_SCRIPT]),
  });
  const flock = put(g, 'p1', FLOCK);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, flock, revealed };
}

describe('Wakandan Drone Flock', () => {
  test('the entry asks a scry 2, and it is NOT a surveil', () => {
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

  test('the Flock flies', () => {
    const { g, flock, revealed } = entered();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a, b], toBottom: [] }));
    settle(g);
    const d = deps(createRegistry([WAKANDAN_DRONE_FLOCK_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, flock).keywords.has('flying')).toBe(true);
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
