// `Soaring Seacliff` — the land enters tapped AND its trigger grants flying
// until cleanup: both halves of the three-line card in one game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOARING_SEACLIFF_SCRIPT } from './soaringSeacliff';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cliffed(): { g: Game; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Soaring Seacliff', 'Grizzly Bears'], []],
    scripts: createRegistry([SOARING_SEACLIFF_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  const land = put(g, 'p1', 'Soaring Seacliff');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, land, bears };
}

describe('Soaring Seacliff', () => {
  test('enters tapped, and the Bears flies until cleanup', () => {
    const { g, land, bears } = cliffed();
    expect(g.state.cards[land]?.tapped).toBe(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = cliffed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
