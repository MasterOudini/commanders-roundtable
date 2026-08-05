// `Braidwood Cup` — one tap, one life; an artifact needs no sickness wait.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRAIDWOOD_CUP_SCRIPT } from './braidwoodCup';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CUP = 'Braidwood Cup';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; cup: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CUP], []],
    scripts: createRegistry([BRAIDWOOD_CUP_SCRIPT]),
  });
  const cup = put(g, 'p1', CUP);
  settle(g);
  return { g, cup };
}

describe('Braidwood Cup', () => {
  test('gains 1 life with the Cup turned by the cost', () => {
    const { g, cup } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cup, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[cup]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, cup } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cup, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
