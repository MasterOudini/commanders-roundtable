// `Thunderscape Apprentice` — {B} and the tap drain the opponent for 1; {G}
// and the tap give a creature +1/+1 until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THUNDERSCAPE_APPRENTICE_SCRIPT } from './thunderscapeApprentice';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const APPRENTICE = 'Thunderscape Apprentice';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([THUNDERSCAPE_APPRENTICE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function board(): { g: Game; apprentice: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[APPRENTICE, BEARS], []],
    scripts: createRegistry([THUNDERSCAPE_APPRENTICE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const apprentice = put(g, 'p1', APPRENTICE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, apprentice, bears };
}

describe('Thunderscape Apprentice', () => {
  test('{B}, {T}: the opponent loses 1 life', () => {
    const { g, apprentice } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[apprentice]?.tapped).toBe(true);
  });

  test('{G}, {T}: +1/+1 on the bear, gone at cleanup', () => {
    const { g, apprentice, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 3, toughness: 3 });
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('replays to the same hash', () => {
    const { g, apprentice, bears } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
