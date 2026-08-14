// `Haazda Marshal` — three attackers with the Marshal among them pay the
// lifelink Soldier; two attackers pay nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HAAZDA_MARSHAL_SCRIPT } from './haazdaMarshal';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MARSHAL = 'Haazda Marshal';
const BEARS = 'Grizzly Bears';
const GOBLIN = 'Raging Goblin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Soldier').length;
}

function board(): { g: Game; marshal: InstanceId; bears: InstanceId; goblin: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MARSHAL, BEARS, GOBLIN], []],
    scripts: createRegistry([HAAZDA_MARSHAL_SCRIPT]),
  });
  const marshal = put(g, 'p1', MARSHAL);
  const bears = put(g, 'p1', BEARS);
  const goblin = put(g, 'p1', GOBLIN);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  return { g, marshal, bears, goblin };
}

describe('Haazda Marshal', () => {
  test('the Marshal plus two others attacking pays the Soldier', () => {
    const { g, marshal, bears, goblin } = board();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: marshal, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
          { card: goblin, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    expect(soldiers(g)).toBe(1);
  });

  test('two attackers — the Marshal and ONE other — pay nothing', () => {
    const { g, marshal, bears } = board();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: marshal, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    expect(soldiers(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, marshal, bears, goblin } = board();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: marshal, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
          { card: goblin, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
