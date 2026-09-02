// `Cogworker's Puzzleknot` — a Servo on entry, a second Servo for the
// Puzzleknot itself.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COGWORKERS_PUZZLEKNOT_SCRIPT } from './cogworkersPuzzleknot';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PUZZLEKNOT = "Cogworker's Puzzleknot";
const SERVO = TOKEN_TABLE['Servo|1/1||Artifact Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function servosOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SERVO?.printingId;
  }).length;
}

function placed(): { g: Game; knot: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PUZZLEKNOT], []],
    scripts: createRegistry([COGWORKERS_PUZZLEKNOT_SCRIPT]),
  });
  const knot = put(g, 'p1', PUZZLEKNOT);
  settle(g);
  return { g, knot };
}

describe("Cogworker's Puzzleknot", () => {
  test('entering makes a Servo', () => {
    const { g } = placed();
    expect(servosOf(g, 'p1')).toBe(1);
  });

  test('{1}{W}, sacrifice: a second Servo, the Puzzleknot gone', () => {
    const { g, knot } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: knot, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(servosOf(g, 'p1')).toBe(2);
    expect(g.state.cards[knot]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, knot } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: knot, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
