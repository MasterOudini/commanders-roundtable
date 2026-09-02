// `Yeva's Forcemage` — the entry hands out +2/+2, gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { YEVAS_FORCEMAGE_SCRIPT } from './yevasForcemage';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FORCEMAGE = "Yeva's Forcemage";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FORCEMAGE, BEARS], []],
    scripts: createRegistry([YEVAS_FORCEMAGE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', FORCEMAGE);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([YEVAS_FORCEMAGE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe("Yeva's Forcemage", () => {
  test('the target is 4/4', () => {
    const { g, bears } = entered();
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
  });

  test('cleanup takes it back (CR 514.2)', () => {
    const { g, bears } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
