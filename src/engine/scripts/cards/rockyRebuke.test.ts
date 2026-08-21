// `Rocky Rebuke` — the 6/6 bites the 2/2 one way: the Bears die, the
// Dreadmaw is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROCKY_REBUKE_SCRIPT } from './rockyRebuke';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rebuked(): { g: Game; maw: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rocky Rebuke', 'Colossal Dreadmaw'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([ROCKY_REBUKE_SCRIPT]),
  });
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Rocky Rebuke', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: maw },
        { kind: 'card', id: bears },
      ],
    }),
  );
  settle(g);
  return { g, maw, bears };
}

describe('Rocky Rebuke', () => {
  test('one-way: the Bears die and the Dreadmaw stands', () => {
    const { g, maw, bears } = rebuked();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = rebuked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
