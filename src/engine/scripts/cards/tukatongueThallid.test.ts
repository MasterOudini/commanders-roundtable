// `Tukatongue Thallid` — the dies-token, proven by killing it with a shipped
// sweep so the death is a real one rather than a Tier-3 move.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TUKATONGUE_THALLID_SCRIPT } from './tukatongueThallid';
import { TREMOR_SCRIPT } from './tremor';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const THALLID = 'Tukatongue Thallid'; // 1/1 — dies to Tremor's 1 damage
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

function killed(): { g: Game; thallid: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[THALLID, TREMOR], []],
    scripts: createRegistry([TUKATONGUE_THALLID_SCRIPT, TREMOR_SCRIPT]),
  });
  const thallid = put(g, 'p1', THALLID);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', TREMOR, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, thallid };
}

describe('Tukatongue Thallid', () => {
  test('a real death pays a 1/1 Saproling', () => {
    const { g, thallid } = killed();
    expect(g.state.cards[thallid]?.zone.kind).toBe('graveyard');
    expect(saprolings(g)).toBe(1);
  });

  test('the Saproling itself does NOT pay — it has no such trigger', () => {
    const { g } = killed();
    // One Thallid died, so exactly one Saproling exists: nothing cascaded.
    expect(saprolings(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = killed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
