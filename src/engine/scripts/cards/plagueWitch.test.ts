// `Plague Witch` — black mana, the tap and a discarded card give the
// opponent's bear -1/-1 until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PLAGUE_WITCH_SCRIPT } from './plagueWitch';
import { advanceUntil, deps, idsIn, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WITCH = 'Plague Witch';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([PLAGUE_WITCH_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function ready(): { g: Game; witch: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WITCH], [BEARS]],
    scripts: createRegistry([PLAGUE_WITCH_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const witch = put(g, 'p1', WITCH);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, witch, theirs };
}

describe('Plague Witch', () => {
  test('{B}, {T}, discard a card: -1/-1 on their bear until cleanup', () => {
    const { g, witch, theirs } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witch, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
    expect(pt(g, theirs)).toEqual({ power: 1, toughness: 1 });
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(pt(g, theirs)).toEqual({ power: 2, toughness: 2 });
  });

  test('replays to the same hash', () => {
    const { g, witch, theirs } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witch, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
