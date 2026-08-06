// `Dispersing Orb` — any permanent pays the empty predicate, and the bounce
// goes to the target's OWNER's hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DISPERSING_ORB_SCRIPT } from './dispersingOrb';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ORB = 'Dispersing Orb';
const MOUNTAIN = 'Mountain';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; orb: InstanceId; mountain: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ORB, MOUNTAIN], [BEARS]],
    scripts: createRegistry([DISPERSING_ORB_SCRIPT]),
  });
  const orb = put(g, 'p1', ORB);
  const mountain = put(g, 'p1', MOUNTAIN);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, orb, mountain, theirs };
}

describe('Dispersing Orb', () => {
  test('a land pays "a permanent", and the bounce reaches the OWNER\'s hand', () => {
    const { g, orb, mountain, theirs } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: orb, abilityIndex: 0, sacrifice: mountain }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[mountain]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.kind === 'hand' && g.state.cards[theirs]?.zone.player).toBe('p2');
    expect(g.state.cards[orb]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, orb, mountain, theirs } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: orb, abilityIndex: 0, sacrifice: mountain }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
