// `Earthblighter` — a Goblin pays, a bear does not, and the land dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EARTHBLIGHTER_SCRIPT } from './earthblighter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BLIGHTER = 'Earthblighter';
const GOBLIN = 'Krenko, Mob Boss';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; blighter: InstanceId; goblin: InstanceId; myBears: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BLIGHTER, GOBLIN, BEARS], [MOUNTAIN]],
    scripts: createRegistry([EARTHBLIGHTER_SCRIPT]),
  });
  const blighter = put(g, 'p1', BLIGHTER);
  const goblin = put(g, 'p1', GOBLIN);
  const myBears = put(g, 'p1', BEARS);
  const land = put(g, 'p2', MOUNTAIN);
  settle(g);
  // {T} in the cost — the Blighter must be past summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, blighter, goblin, myBears, land };
}

describe('Earthblighter', () => {
  test('a Goblin pays and the target land is destroyed', () => {
    const { g, blighter, goblin, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: blighter, abilityIndex: 0, sacrifice: goblin }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    expect(g.state.cards[goblin]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[blighter]?.zone.kind).toBe('battlefield');
  });

  test('a NON-Goblin creature cannot pay the Goblin-only cost', () => {
    const { g, blighter, myBears } = board();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: blighter, abilityIndex: 0, sacrifice: myBears });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, blighter, goblin, land } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: blighter, abilityIndex: 0, sacrifice: goblin }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
