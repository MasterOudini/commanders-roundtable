// `Vulshok Heartstoker` — +2/+0 is POWER ONLY, so a pumped 2/2 still trades
// with a 2/2 (D255). Cleanup takes it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VULSHOK_HEARTSTOKER_SCRIPT } from './vulshokHeartstoker';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const STOKER = 'Vulshok Heartstoker';
const BEARS = 'Grizzly Bears'; // 2/2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[STOKER, BEARS], []],
    scripts: createRegistry([VULSHOK_HEARTSTOKER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', STOKER);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

// ⚠️ Derived P/T is `number | null` — a non-creature has none.
function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([VULSHOK_HEARTSTOKER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Vulshok Heartstoker', () => {
  test('the target is 4/2 — power only', () => {
    const { g, bears } = entered();
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 2 });
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
