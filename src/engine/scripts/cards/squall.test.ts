// `Squall` — the 1/1 flyer dies; the grounded Bears stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SQUALL_SCRIPT } from './squall';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function squalled(): { g: Game; flyer: InstanceId; ground: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Squall', 'Grizzly Bears'], ['Skyscanner']],
    scripts: createRegistry([SQUALL_SCRIPT]),
  });
  const ground = put(g, 'p1', 'Grizzly Bears');
  const flyer = put(g, 'p2', 'Skyscanner');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Squall', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flyer, ground };
}

describe('Squall', () => {
  test('the flyer dies; the ground Bears stand', () => {
    const { g, flyer, ground } = squalled();
    expect(g.state.cards[flyer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = squalled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
