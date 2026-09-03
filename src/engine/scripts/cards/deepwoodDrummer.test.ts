// `Deepwood Drummer` — green mana, the tap and a discarded card give my
// bear +2/+2 until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEEPWOOD_DRUMMER_SCRIPT } from './deepwoodDrummer';
import { advanceUntil, deps, idsIn, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRUMMER = 'Deepwood Drummer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([DEEPWOOD_DRUMMER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function ready(): { g: Game; drummer: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRUMMER, BEARS], []],
    scripts: createRegistry([DEEPWOOD_DRUMMER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const drummer = put(g, 'p1', DRUMMER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, drummer, bears };
}

describe('Deepwood Drummer', () => {
  test('{G}, {T}, discard a card: +2/+2 on the bear until cleanup', () => {
    const { g, drummer, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: drummer, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('replays to the same hash', () => {
    const { g, drummer, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: drummer, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
