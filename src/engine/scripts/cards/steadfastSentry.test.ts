// `Steadfast Sentry` — its death pays a counter onto my Bears (the family's
// third id).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STEADFAST_SENTRY_SCRIPT } from './steadfastSentry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sentried(): { g: Game; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Steadfast Sentry', 'Grizzly Bears'], []],
    scripts: createRegistry([STEADFAST_SENTRY_SCRIPT]),
  });
  const sentry = put(g, 'p1', 'Steadfast Sentry');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: sentry,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
  settle(g);
  return { g, mine };
}

describe('Steadfast Sentry', () => {
  test('the death pays a +1/+1 counter', () => {
    const { g, mine } = sentried();
    expect(g.state.cards[mine]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = sentried();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
