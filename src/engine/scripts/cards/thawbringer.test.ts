// `Thawbringer` — one printed line, two arms: entering asks and dying asks.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THAWBRINGER_SCRIPT } from './thawbringer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const THAW = 'Thawbringer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Answers the standing surveil by keeping the top card. */
function answer(g: Game): void {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
  expect(revealed).toHaveLength(1);
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
}

function game(): { g: Game; thaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[THAW], []],
    scripts: createRegistry([THAWBRINGER_SCRIPT]),
  });
  const thaw = put(g, 'p1', THAW);
  return { g, thaw };
}

describe('Thawbringer', () => {
  test('ENTERING asks the surveil', () => {
    const { g } = game();
    answer(g);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('DYING asks it again — the same line, the other arm', () => {
    const { g, thaw } = game();
    answer(g);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: thaw,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    answer(g);
    settle(g);
    expect(g.state.cards[thaw]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, thaw } = game();
    answer(g);
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: thaw,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    answer(g);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
