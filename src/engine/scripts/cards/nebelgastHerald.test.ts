// `Nebelgast Herald` — its own entry asks; a Spirit token entering asks; a
// non-Spirit pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEBELGAST_HERALD_SCRIPT } from './nebelgastHerald';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function heralded(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nebelgast Herald', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([NEBELGAST_HERALD_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Nebelgast Herald');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Nebelgast Herald', () => {
  test('its own entry taps the opponent creature; a non-Spirit entry pays nothing', () => {
    const { g, bears } = heralded();
    expect(g.state.cards[bears]?.tapped).toBe(true);
    const logAt = g.log.length;
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    // The Bears is no Spirit — no new prompt, no new tap.
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseTargets');
    expect(g.log.slice(logAt).some((e) => e.body.t === 'PermanentsTapped')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = heralded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
