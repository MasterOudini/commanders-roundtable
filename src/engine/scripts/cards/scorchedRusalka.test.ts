// `Scorched Rusalka` — a creature pays and the ping lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCORCHED_RUSALKA_SCRIPT } from './scorchedRusalka';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scorched(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Scorched Rusalka', 'Grizzly Bears'], []],
    scripts: createRegistry([SCORCHED_RUSALKA_SCRIPT]),
  });
  const rusalka = put(g, 'p1', 'Scorched Rusalka');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: rusalka,
      abilityIndex: 0,
      sacrifice: bears,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Scorched Rusalka', () => {
  test('the Bears pay and p2 takes 1', () => {
    const { g, bears } = scorched();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g } = scorched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
