// `Sustenance` — a sacrificed LAND pays the pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUSTENANCE_SCRIPT } from './sustenance';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sustained(): { g: Game; bears: InstanceId; swamp: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sustenance', 'Grizzly Bears', 'Swamp'], []],
    scripts: createRegistry([SUSTENANCE_SCRIPT]),
  });
  const enchantment = put(g, 'p1', 'Sustenance');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const swamp = put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: enchantment,
      abilityIndex: 0,
      sacrifice: swamp,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, swamp };
}

describe('Sustenance', () => {
  test('the Swamp pays and the Bears grows', () => {
    const { g, bears, swamp } = sustained();
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = sustained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
