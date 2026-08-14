// `Gargoyle Castle` — {5},{T},Sacrifice: the Castle dies, the 3/4 Gargoyle
// arrives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GARGOYLE_CASTLE_SCRIPT } from './gargoyleCastle';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CASTLE = 'Gargoyle Castle';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gargoyles(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Gargoyle').length;
}

function board(): { g: Game; castle: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CASTLE], []],
    scripts: createRegistry([GARGOYLE_CASTLE_SCRIPT]),
  });
  const castle = put(g, 'p1', CASTLE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  return { g, castle };
}

describe('Gargoyle Castle', () => {
  test('sacrifices itself for the 3/4 Gargoyle', () => {
    const { g, castle } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: castle, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[castle]?.zone.kind).toBe('graveyard');
    expect(gargoyles(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, castle } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: castle, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
