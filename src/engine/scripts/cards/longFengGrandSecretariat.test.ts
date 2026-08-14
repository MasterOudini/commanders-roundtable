// `Long Feng, Grand Secretariat` — BOTH arms of the dies watcher: another
// creature of mine, and a land of mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LONG_FENG_GRAND_SECRETARIAT_SCRIPT } from './longFengGrandSecretariat';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LONG_FENG = 'Long Feng, Grand Secretariat';
const BEARS = 'Grizzly Bears';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; feng: InstanceId; bears: InstanceId; forest: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LONG_FENG, BEARS, FOREST], []],
    scripts: createRegistry([LONG_FENG_GRAND_SECRETARIAT_SCRIPT]),
  });
  const feng = put(g, 'p1', LONG_FENG);
  const bears = put(g, 'p1', BEARS);
  const forest = put(g, 'p1', FOREST);
  settle(g);
  return { g, feng, bears, forest };
}

describe('Long Feng, Grand Secretariat', () => {
  test('another creature of mine dying grows the chosen creature', () => {
    const { g, feng, bears } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: feng }] }));
    settle(g);
    expect(g.state.cards[feng]?.counters['+1/+1']).toBe(1);
  });

  test('a LAND of mine dying pays too — the second arm', () => {
    const { g, feng, forest } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: forest,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: feng }] }));
    settle(g);
    expect(g.state.cards[feng]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, feng, bears } = board();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: feng }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
