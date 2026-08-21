// `Shadewing Laureate` — a grounded creature dying asks nothing; a FLYER
// dying asks and the counter lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHADEWING_LAUREATE_SCRIPT } from './shadewingLaureate';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function laureled(): { g: Game; laureate: InstanceId; drake: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Shadewing Laureate', 'Muse Drake', 'Grizzly Bears'], []],
    scripts: createRegistry([SHADEWING_LAUREATE_SCRIPT]),
  });
  const laureate = put(g, 'p1', 'Shadewing Laureate');
  const drake = put(g, 'p1', 'Muse Drake');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  return { g, laureate, drake, bears };
}

function kill(g: Game, card: InstanceId): void {
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
}

describe('Shadewing Laureate', () => {
  test('a grounded death asks nothing; a flyer death pays the counter', () => {
    const { g, laureate, drake, bears } = laureled();
    kill(g, bears);
    settle(g);
    expect(g.state.cards[laureate]?.counters['+1/+1'] ?? 0).toBe(0);
    kill(g, drake);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(
      g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: laureate }] }),
    );
    settle(g);
    expect(g.state.cards[laureate]?.counters['+1/+1'] ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, laureate, drake } = laureled();
    kill(g, drake);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(
      g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: laureate }] }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
