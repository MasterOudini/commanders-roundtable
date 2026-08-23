// `Welkin Guide` — the entry pumps AND grants flying in one modification, and
// cleanup takes BOTH back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WELKIN_GUIDE_SCRIPT } from './welkinGuide';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUIDE = 'Welkin Guide';
const BEARS = 'Grizzly Bears'; // 2/2, no flying

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GUIDE, BEARS], []],
    scripts: createRegistry([WELKIN_GUIDE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', GUIDE);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

function look(g: Game, id: InstanceId) {
  const d = deps(createRegistry([WELKIN_GUIDE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id);
}

describe('Welkin Guide', () => {
  test('the target is 4/4 AND flying', () => {
    const { g, bears } = entered();
    const got = look(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 4, toughness: 4 });
    expect(got.keywords.has('flying')).toBe(true);
  });

  test('cleanup takes BOTH back (CR 514.2)', () => {
    const { g, bears } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const got = look(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 2, toughness: 2 });
    expect(got.keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
