// `Skirsdag Cultist` — the chooser-fed ping: the Bears pays, the target
// prompt stages, the 2 lands anywhere.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKIRSDAG_CULTIST_SCRIPT } from './skirsdagCultist';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pinged(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Skirsdag Cultist', 'Grizzly Bears'], []],
    scripts: createRegistry([SKIRSDAG_CULTIST_SCRIPT]),
  });
  const cultist = put(g, 'p1', 'Skirsdag Cultist');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: cultist,
      abilityIndex: 0,
      sacrifice: bears,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bears };
}

describe('Skirsdag Cultist', () => {
  test('the Bears pays and p2 takes 2', () => {
    const { g, bears } = pinged();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = pinged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
