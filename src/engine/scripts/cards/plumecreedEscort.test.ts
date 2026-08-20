// `Plumecreed Escort` — the entry grants a controlled creature hexproof
// until cleanup; an opponent's creature is not a legal choice.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PLUMECREED_ESCORT_SCRIPT } from './plumecreedEscort';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function escorted(): { g: Game; bears: InstanceId; theirs: InstanceId; turn: number } {
  const g = startedGame({
    players: 2,
    decks: [['Plumecreed Escort', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([PLUMECREED_ESCORT_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Plumecreed Escort');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] });
  expect(wrong.ok).toBe(false);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, theirs, turn: g.state.turn.turnNumber };
}

describe('Plumecreed Escort', () => {
  test('grants hexproof to its controller creature until end of turn', () => {
    const { g, bears, turn } = escorted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('hexproof')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('hexproof')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, turn } = escorted();
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
