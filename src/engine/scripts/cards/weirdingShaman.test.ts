// `Weirding Shaman` — two Goblin Rogues with DISTINCT ids, and the Shaman is
// itself a Goblin so it may pay its own cost ("a Goblin" is not "another").
// The ability resolves either way, which is CR-correct: an activated ability
// is independent of its source once it is on the stack.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WEIRDING_SHAMAN_SCRIPT } from './weirdingShaman';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SHAMAN = 'Weirding Shaman';
const OTHER_GOBLIN = 'Raging Goblin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rogues(g: Game): InstanceId[] {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Goblin Rogue');
}

function board(): { g: Game; shaman: InstanceId; goblin: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SHAMAN, OTHER_GOBLIN], []],
    scripts: createRegistry([WEIRDING_SHAMAN_SCRIPT]),
  });
  const shaman = put(g, 'p1', SHAMAN);
  const goblin = put(g, 'p1', OTHER_GOBLIN);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  return { g, shaman, goblin };
}

function activate(g: Game, shaman: InstanceId, sacrifice: InstanceId): void {
  must(
    g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 0, sacrifice }),
  );
  settle(g);
}

describe('Weirding Shaman', () => {
  test('eating ANOTHER Goblin leaves two DISTINCT Rogues', () => {
    const { g, shaman, goblin } = board();
    activate(g, shaman, goblin);
    expect(g.state.cards[goblin]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[shaman]?.zone.kind).toBe('battlefield');
    const made = rogues(g);
    expect(made).toHaveLength(2);
    expect(new Set(made).size).toBe(2);
  });

  test('it may eat ITSELF — "a Goblin" is not "another" — and still pays out', () => {
    const { g, shaman } = board();
    activate(g, shaman, shaman);
    expect(g.state.cards[shaman]?.zone.kind).toBe('graveyard');
    const made = rogues(g);
    expect(made).toHaveLength(2);
    expect(new Set(made).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, shaman, goblin } = board();
    activate(g, shaman, goblin);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
