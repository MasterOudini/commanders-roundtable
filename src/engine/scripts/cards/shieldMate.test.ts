// `Shield Mate` — cracks itself for +0/+4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SHIELD_MATE_SCRIPT } from './shieldMate';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mated(): { g: Game; mate: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Shield Mate', 'Grizzly Bears'], []],
    scripts: createRegistry([SHIELD_MATE_SCRIPT]),
  });
  const mate = put(g, 'p1', 'Shield Mate');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: mate,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, mate, bears };
}

describe('Shield Mate', () => {
  test('the Mate pays itself; the target reads 2/6 until cleanup', () => {
    const { g, mate, bears } = mated();
    expect(g.state.cards[mate]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(6);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = mated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
