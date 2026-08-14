// `Glittermonger` — the card D147 pulled from the false mana-ability pool,
// back as a real def: {T} makes a Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GLITTERMONGER_SCRIPT } from './glittermonger';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MONGER = 'Glittermonger';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure').length;
}

function board(): { g: Game; monger: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MONGER], []],
    scripts: createRegistry([GLITTERMONGER_SCRIPT]),
  });
  const monger = put(g, 'p1', MONGER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, monger };
}

describe('Glittermonger', () => {
  test('taps for a Treasure — no mana in the cost', () => {
    const { g, monger } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: monger, abilityIndex: 0 }));
    settle(g);
    expect(treasures(g)).toBe(1);
    expect(g.state.cards[monger]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, monger } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: monger, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
