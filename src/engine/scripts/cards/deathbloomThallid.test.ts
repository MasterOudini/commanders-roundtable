// `Deathbloom Thallid` — dying pays a Saproling, by its exact printing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEATHBLOOM_THALLID_SCRIPT } from './deathbloomThallid';
import { SAPROLING_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const THALLID = 'Deathbloom Thallid';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; thallid: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[THALLID], []],
    scripts: createRegistry([DEATHBLOOM_THALLID_SCRIPT]),
  });
  const thallid = put(g, 'p1', THALLID);
  settle(g);
  return { g, thallid };
}

describe('Deathbloom Thallid', () => {
  test('dying creates the Saproling, by its exact printing', () => {
    const { g, thallid } = game();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: thallid, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.printingId).toBe(SAPROLING_TOKEN.scryfallId);
  });

  test('replays to the same hash', () => {
    const { g, thallid } = game();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: thallid, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
