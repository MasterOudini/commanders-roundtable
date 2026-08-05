// `Acolyte of Xathrid` — the first player-targeted ActivatedDef: loss of life,
// not damage.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ACOLYTE_OF_XATHRID_SCRIPT } from './acolyteOfXathrid';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ACOLYTE = 'Acolyte of Xathrid';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ACOLYTE], []],
    scripts: createRegistry([ACOLYTE_OF_XATHRID_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Acolyte of Xathrid', () => {
  test('target player loses 1 life — a LifeChanged, never a DamageDealt', () => {
    const g = game();
    const id = put(g, 'p1', ACOLYTE);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: id,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.log.some((e) => e.body.t === 'DamageDealt')).toBe(false);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', ACOLYTE);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: id,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
