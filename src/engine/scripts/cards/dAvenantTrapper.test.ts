// `D'Avenant Trapper` — the historic filter: an ARTIFACT cast asks and taps,
// a vanilla bear cast asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { D_AVENANT_TRAPPER_SCRIPT } from './dAvenantTrapper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TRAPPER = "D'Avenant Trapper";
const ARTIFACT = 'Hedron Archive';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TRAPPER, ARTIFACT, BEARS], [BEARS]],
    scripts: createRegistry([D_AVENANT_TRAPPER_SCRIPT]),
  });
  put(g, 'p1', TRAPPER);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  return { g, theirs };
}

describe("D'Avenant Trapper", () => {
  test('an artifact cast is historic: the prompt comes up and the answer taps', () => {
    const { g, theirs } = game();
    const artifact = put(g, 'p1', ARTIFACT, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: artifact }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('a vanilla bear is not historic', () => {
    const { g } = game();
    const bears = put(g, 'p1', BEARS, 'hand');
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'AbilityPutOnStack')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, theirs } = game();
    const artifact = put(g, 'p1', ARTIFACT, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: artifact }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
