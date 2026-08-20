// `Odric's Outrider` — another of my creatures dying asks; the counter
// lands on my pick.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ODRICS_OUTRIDER_SCRIPT } from './odricsOutrider';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ridden(): { g: Game; outrider: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Odric's Outrider", 'Grizzly Bears'], []],
    scripts: createRegistry([ODRICS_OUTRIDER_SCRIPT]),
  });
  const outrider = put(g, 'p1', "Odric's Outrider");
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: bears,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: outrider }] }));
  settle(g);
  return { g, outrider };
}

describe("Odric's Outrider", () => {
  test('another of mine dying pays a counter onto my pick', () => {
    const { g, outrider } = ridden();
    expect(g.state.cards[outrider]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = ridden();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
