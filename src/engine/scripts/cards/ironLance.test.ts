// `Iron Lance` — the paid tap grants derived first strike for the turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { IRON_LANCE_SCRIPT } from './ironLance';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function lanced(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Iron Lance', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([IRON_LANCE_SCRIPT]),
  });
  const lance = put(g, 'p1', 'Iron Lance');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lance, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Iron Lance', () => {
  test('the paid tap grants DERIVED first strike, and cleanup ends it', () => {
    const { g, bears } = lanced();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('firstStrike')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('firstStrike')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = lanced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
