// `Undercellar Myconid` — BOTH arms of the one printed line, in one game:
// two Saprolings from an entry and a death.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNDERCELLAR_MYCONID_SCRIPT } from './undercellarMyconid';
import { TREMOR_SCRIPT } from './tremor';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MYCONID = 'Undercellar Myconid'; // 2/2, so Tremor's 1 will not kill it
const TREMOR = 'Tremor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saprolings(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Saproling';
  }).length;
}

function game(): { g: Game; myconid: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MYCONID, TREMOR], []],
    scripts: createRegistry([UNDERCELLAR_MYCONID_SCRIPT, TREMOR_SCRIPT]),
  });
  const myconid = put(g, 'p1', MYCONID);
  settle(g);
  return { g, myconid };
}

describe('Undercellar Myconid', () => {
  test('the ENTRY arm pays one Saproling', () => {
    const { g } = game();
    expect(saprolings(g)).toBe(1);
  });

  test('the DIES arm pays a second one on the same card', () => {
    const { g, myconid } = game();
    expect(saprolings(g)).toBe(1);
    // Kill it with a Tier-3 move rather than damage: the Myconid is a 2/2.
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: myconid,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(g.state.cards[myconid]?.zone.kind).toBe('graveyard');
    expect(saprolings(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, myconid } = game();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: myconid,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
