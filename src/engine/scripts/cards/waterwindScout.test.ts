// `Waterwind Scout` — flying plus one Map token on the entry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WATERWIND_SCOUT_SCRIPT } from './waterwindScout';
import { advanceUntil, battlefieldOf, deps, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SCOUT = 'Waterwind Scout';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; scout: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SCOUT], []],
    scripts: createRegistry([WATERWIND_SCOUT_SCRIPT]),
  });
  const scout = put(g, 'p1', SCOUT);
  settle(g);
  return { g, scout };
}

describe('Waterwind Scout', () => {
  test('the entry makes one Map', () => {
    const { g } = entered();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Map')).toHaveLength(1);
  });

  test('the Scout flies', () => {
    const { g, scout } = entered();
    const d = deps(createRegistry([WATERWIND_SCOUT_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, scout).keywords.has('flying')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
