// `Junktown` — {4}{R}, the tap and itself pay for THREE Junk with distinct
// ids.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JUNKTOWN_SCRIPT } from './junktown';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const JUNKTOWN = 'Junktown';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(): { g: Game; junktown: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[JUNKTOWN], []],
    scripts: createRegistry([JUNKTOWN_SCRIPT]),
  });
  const junktown = put(g, 'p1', JUNKTOWN);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: junktown, abilityIndex: 1 }));
  settle(g);
  return { g, junktown };
}

describe('Junktown', () => {
  test('paying {4}{R}, the tap and itself creates three Junk with distinct ids', () => {
    const { g, junktown } = fired();
    const junk = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Junk');
    expect(junk).toHaveLength(3);
    expect(new Set(junk).size).toBe(3);
    expect(g.state.cards[junktown]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = fired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
