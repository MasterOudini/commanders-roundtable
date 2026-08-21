// `Starved Rusalka` — paying with ITSELF still gains the 1 (CR 113.7a).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STARVED_RUSALKA_SCRIPT } from './starvedRusalka';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function starved(): { g: Game; rusalka: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Starved Rusalka'], []],
    scripts: createRegistry([STARVED_RUSALKA_SCRIPT]),
  });
  const rusalka = put(g, 'p1', 'Starved Rusalka');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: rusalka,
      abilityIndex: 0,
      sacrifice: rusalka,
    }),
  );
  settle(g);
  return { g, rusalka };
}

describe('Starved Rusalka', () => {
  test('paying with itself still gains the 1', () => {
    const { g, rusalka } = starved();
    expect(g.state.cards[rusalka]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = starved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
