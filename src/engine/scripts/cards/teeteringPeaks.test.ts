// `Teetering Peaks` — the targeted ETB on a land that also enters tapped:
// both printed rules, and the pump is gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEETERING_PEAKS_SCRIPT } from './teeteringPeaks';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PEAKS = 'Teetering Peaks';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; peaks: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PEAKS, BEARS], []],
    scripts: createRegistry([TEETERING_PEAKS_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  // ⚠️ MOVED onto the battlefield, not PLAYED as a land -- the D134 entry
  // funnel catches every path onto the battlefield (D145 proved it on a shock
  // land), and a real land drop lets auto-pass run the turn out from under the
  // pump: the +2/+0 lands and CLEANUP wipes it before the assertion. Looming
  // Spires' test (D222), the same shape, moves it for the same reason.
  const peaks = put(g, 'p1', PEAKS);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, peaks, bears };
}

describe('Teetering Peaks', () => {
  test('enters tapped AND pumps the target +2/+0', () => {
    const { g, peaks, bears } = entered();
    expect(g.state.cards[peaks]?.tapped).toBe(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(2);
  });

  test('the pump ends at cleanup, and it replays to the same hash', () => {
    const { g, bears } = entered();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
