// `Cogwork Wrestler` — the -2/-0 on an opponent's creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COGWORK_WRESTLER_SCRIPT } from './cogworkWrestler';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WRESTLER = 'Cogwork Wrestler';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WRESTLER], ['Silvercoat Lion']],
    scripts: createRegistry([COGWORK_WRESTLER_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Silvercoat Lion');
  settle(g);
  const gnome = put(g, 'p1', WRESTLER, 'graveyard');
  settle(g);
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: gnome, to: { kind: 'battlefield', player: 'p1' } }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Cogwork Wrestler', () => {
  test("entering gives the opponent's creature -2/-0 until end of turn", () => {
    const { g, theirs } = board();
    expect(
      g.log.some(
        (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === theirs && e.body.power === -2,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
