// `Mawcor` — the tap pings any target for 1; a player works.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAWCOR_SCRIPT } from './mawcor';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAWCOR = 'Mawcor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mawcor: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAWCOR], []],
    scripts: createRegistry([MAWCOR_SCRIPT]),
  });
  const mawcor = put(g, 'p1', MAWCOR);
  settle(g);
  // A creature's {T} waits out summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mawcor, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, mawcor };
}

describe('Mawcor', () => {
  test('pings a player for 1', () => {
    const { g, mawcor } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[mawcor]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
