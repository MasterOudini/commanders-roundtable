// `Third Path Savant` — {7} draws TWO, and with no tap in the cost it can be
// paid twice in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THIRD_PATH_SAVANT_SCRIPT } from './thirdPathSavant';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SAVANT = 'Third Path Savant';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function game(): { g: Game; savant: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SAVANT], []],
    scripts: createRegistry([THIRD_PATH_SAVANT_SCRIPT]),
  });
  const savant = put(g, 'p1', SAVANT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 14 }));
  return { g, savant };
}

describe('Third Path Savant', () => {
  test('{7} draws two', () => {
    const { g, savant } = game();
    const since = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: savant, abilityIndex: 0 }));
    settle(g);
    expect(drawn(g, since)).toBe(2);
  });

  test('no tap in the cost, so it pays TWICE in one turn', () => {
    const { g, savant } = game();
    const since = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: savant, abilityIndex: 0 }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: savant, abilityIndex: 0 }));
    settle(g);
    expect(drawn(g, since)).toBe(4);
    expect(g.state.cards[savant]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, savant } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: savant, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
