// `Thornscape Apprentice` — {R} and the tap give my creature first strike
// until cleanup; {W} and the tap tap theirs.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THORNSCAPE_APPRENTICE_SCRIPT } from './thornscapeApprentice';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const APPRENTICE = 'Thornscape Apprentice';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chars(g: Game, id: InstanceId): ReturnType<typeof derive> {
  const d = deps(createRegistry([THORNSCAPE_APPRENTICE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id);
}

function board(): { g: Game; apprentice: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[APPRENTICE, BEARS], [BEARS]],
    scripts: createRegistry([THORNSCAPE_APPRENTICE_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const apprentice = put(g, 'p1', APPRENTICE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, apprentice, mine, theirs };
}

describe('Thornscape Apprentice', () => {
  test('{R}, {T}: first strike on my creature, gone at cleanup', () => {
    const { g, apprentice, mine } = board();
    expect(chars(g, mine).keywords.has('firstStrike')).toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(chars(g, mine).keywords.has('firstStrike')).toBe(true);
    expect(g.state.cards[apprentice]?.tapped).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(chars(g, mine).keywords.has('firstStrike')).toBe(false);
  });

  test("{W}, {T}: the opponent's creature is tapped", () => {
    const { g, apprentice, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, apprentice, mine } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
