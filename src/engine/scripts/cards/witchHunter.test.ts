// `Witch Hunter` — the tap pings the opponent for 1; three mana and the tap
// bounce their creature; my own creature is refused as that target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WITCH_HUNTER_SCRIPT } from './witchHunter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HUNTER = 'Witch Hunter';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; hunter: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HUNTER, BEARS], [BEARS]],
    scripts: createRegistry([WITCH_HUNTER_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const hunter = put(g, 'p1', HUNTER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, hunter, mine, theirs };
}

describe('Witch Hunter', () => {
  test('{T}: 1 damage to the opponent', () => {
    const { g, hunter } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hunter, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[hunter]?.tapped).toBe(true);
  });

  test("{1}{W}{W}, {T}: the opponent's creature returns to their hand", () => {
    const { g, hunter, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hunter, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('my own creature is refused ("an opponent controls")', () => {
    const { g, hunter, mine } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hunter, abilityIndex: 1 }));
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hunter, theirs } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hunter, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
