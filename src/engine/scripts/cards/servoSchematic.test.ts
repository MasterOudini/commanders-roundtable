// `Servo Schematic` — one Servo on entry, a second on death: both arms
// in one game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SERVO_SCHEMATIC_SCRIPT } from './servoSchematic';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function schemed(): { g: Game; schematic: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Servo Schematic'], []],
    scripts: createRegistry([SERVO_SCHEMATIC_SCRIPT]),
  });
  const schematic = put(g, 'p1', 'Servo Schematic');
  settle(g);
  return { g, schematic };
}

describe('Servo Schematic', () => {
  test('one Servo on entry, a second on death', () => {
    const { g, schematic } = schemed();
    expect(tokens(g)).toBe(1);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: schematic,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(tokens(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, schematic } = schemed();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: schematic,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
