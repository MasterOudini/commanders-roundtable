// `Bloodtallow Candle` — the -5/-5 lands as a modifier and the SBA does the
// killing: a 2/2 at -5/-5 dies without the script destroying anything.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOODTALLOW_CANDLE_SCRIPT } from './bloodtallowCandle';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CANDLE = 'Bloodtallow Candle';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; candle: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CANDLE], ['Grizzly Bears']],
    scripts: createRegistry([BLOODTALLOW_CANDLE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const candle = put(g, 'p1', CANDLE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
  return { g, candle, bears };
}

describe('Bloodtallow Candle', () => {
  test('the -5/-5 kills a 2/2 through the SBA, with the Candle spent', () => {
    const { g, candle, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: candle,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(
      g.log.some(
        (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === -5,
      ),
    ).toBe(true);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[candle]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, candle, bears } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: candle,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
