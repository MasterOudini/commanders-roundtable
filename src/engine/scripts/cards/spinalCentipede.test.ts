// `Spinal Centipede` — its death pays a counter onto my Bears.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPINAL_CENTIPEDE_SCRIPT } from './spinalCentipede';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spined(): { g: Game; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Spinal Centipede', 'Grizzly Bears'], []],
    scripts: createRegistry([SPINAL_CENTIPEDE_SCRIPT]),
  });
  const centipede = put(g, 'p1', 'Spinal Centipede');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: centipede,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
  settle(g);
  return { g, mine };
}

describe('Spinal Centipede', () => {
  test('the death pays a +1/+1 counter', () => {
    const { g, mine } = spined();
    expect(g.state.cards[mine]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = spined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
