// `Skull Catapult` — an artifact is never summoning-sick: the Bears pays on
// turn 1 and p2 takes the 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKULL_CATAPULT_SCRIPT } from './skullCatapult';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function catapulted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Skull Catapult', 'Grizzly Bears'], []],
    scripts: createRegistry([SKULL_CATAPULT_SCRIPT]),
  });
  const catapult = put(g, 'p1', 'Skull Catapult');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: catapult,
      abilityIndex: 0,
      sacrifice: bears,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bears };
}

describe('Skull Catapult', () => {
  test('the Bears pays and p2 takes 2', () => {
    const { g, bears } = catapulted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = catapulted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
