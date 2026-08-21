// `Reputable Merchant` — a counter on entry, another on death, both
// through the arrow.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REPUTABLE_MERCHANT_SCRIPT } from './reputableMerchant';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function traded(): { g: Game; merchant: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Reputable Merchant', 'Grizzly Bears'], []],
    scripts: createRegistry([REPUTABLE_MERCHANT_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  const merchant = put(g, 'p1', 'Reputable Merchant');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, merchant, bears };
}

describe('Reputable Merchant', () => {
  test('the entry pays one counter; the death pays another', () => {
    const { g, merchant, bears } = traded();
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: merchant, to: { kind: 'graveyard', player: 'p1' } }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = traded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
