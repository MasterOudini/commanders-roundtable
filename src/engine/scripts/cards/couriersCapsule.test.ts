// `Courier's Capsule` — the self-sacrifice price paying for a two-card draw:
// the Capsule is spent AT ACTIVATION, and "draw two" is counted in MOVES,
// never events (D163's Locket lesson).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COURIERS_CAPSULE_SCRIPT } from './couriersCapsule';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CAPSULE = "Courier's Capsule";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawMoves(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    for (const m of e.body.moves) {
      if (m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player) n++;
    }
  }
  return n;
}

function game(): { g: Game; capsule: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CAPSULE], []],
    scripts: createRegistry([COURIERS_CAPSULE_SCRIPT]),
  });
  const capsule = put(g, 'p1', CAPSULE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, capsule };
}

describe("Courier's Capsule", () => {
  test('spent at activation, and TWO moves arrive on resolution', () => {
    const { g, capsule } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: capsule, abilityIndex: 0 }));
    // CR 602.2b — the whole cost is paid before anything can respond.
    expect(g.state.cards[capsule]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(drawMoves(g, 'p1', logAt)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, capsule } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: capsule, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
