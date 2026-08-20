// `Ostiary Thrull` — the Decoy text on its eighth id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OSTIARY_THRULL_SCRIPT } from './ostiaryThrull';
import { OSTIARY_THRULL, MASTER_DECOY } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thrulled(): { g: Game; thrull: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Ostiary Thrull'], ['Grizzly Bears']],
    scripts: createRegistry([OSTIARY_THRULL_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const thrull = put(g, 'p1', 'Ostiary Thrull');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, thrull, bears };
}

describe('Ostiary Thrull', () => {
  test('carries the family text verbatim', () => {
    expect(OSTIARY_THRULL.faces[0]?.oracleText).toBe(MASTER_DECOY.faces[0]?.oracleText);
  });

  test('taps the targeted creature', () => {
    const { g, thrull, bears } = thrulled();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: thrull,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, thrull, bears } = thrulled();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: thrull,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
