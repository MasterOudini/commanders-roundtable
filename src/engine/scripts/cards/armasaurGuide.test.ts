// `Armasaur Guide` — the first attack-count trigger: three attackers ask for
// a target, two attackers ask for nothing, and the counter lands through the
// rules rather than a tool.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARMASAUR_GUIDE_SCRIPT } from './armasaurGuide';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUIDE = 'Armasaur Guide';

function game(): { g: Game; guide: InstanceId; bears: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[GUIDE, 'Grizzly Bears', 'Grizzly Bears'], []],
    scripts: createRegistry([ARMASAUR_GUIDE_SCRIPT]),
  });
  const guide = put(g, 'p1', GUIDE);
  const bears = [put(g, 'p1', 'Grizzly Bears'), put(g, 'p1', 'Grizzly Bears')];
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  return { g, guide, bears };
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Armasaur Guide', () => {
  test('attacking with THREE creatures triggers and puts the counter on the chosen target', () => {
    const { g, guide, bears } = game();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [guide, ...bears].map((card) => ({
          card,
          defender: { kind: 'player' as const, id: 'p2' },
        })),
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: guide }] }));
    settle(g);
    expect(g.state.cards[guide]?.counters['+1/+1']).toBe(1);
  });

  test('attacking with TWO creatures triggers nothing', () => {
    const { g, bears } = game();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: bears.map((card) => ({
          card,
          defender: { kind: 'player' as const, id: 'p2' },
        })),
      }),
    );
    settle(g);
    expect(g.log.some((e) => e.body.t === 'CountersChanged')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, guide, bears } = game();
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [guide, ...bears].map((card) => ({
          card,
          defender: { kind: 'player' as const, id: 'p2' },
        })),
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: guide }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
