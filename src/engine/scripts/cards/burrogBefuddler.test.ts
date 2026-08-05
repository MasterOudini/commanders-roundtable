// `Burrog Befuddler` — the -1/-0 on an opponent's creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BURROG_BEFUDDLER_SCRIPT } from './burrogBefuddler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BURROG = 'Burrog Befuddler';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BURROG], ['Silvercoat Lion']],
    scripts: createRegistry([BURROG_BEFUDDLER_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Silvercoat Lion');
  settle(g);
  const frog = put(g, 'p1', BURROG, 'graveyard');
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: frog, to: { kind: 'battlefield', player: 'p1' } }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Burrog Befuddler', () => {
  test("entering gives the opponent's creature -1/-0 until end of turn", () => {
    const { g, theirs } = board();
    expect(
      g.log.some(
        (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === theirs && e.body.power === -1,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
