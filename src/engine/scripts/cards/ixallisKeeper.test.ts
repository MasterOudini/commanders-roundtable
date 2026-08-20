// `Ixalli's Keeper` — the Keeper pays with itself and the target reads
// 7/7 with derived trample.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { IXALLIS_KEEPER_SCRIPT } from './ixallisKeeper';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kept(): { g: Game; keeper: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Ixalli's Keeper", 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([IXALLIS_KEEPER_SCRIPT]),
  });
  const keeper = put(g, 'p1', "Ixalli's Keeper");
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, keeper, bears };
}

describe("Ixalli's Keeper", () => {
  test('the Keeper is spent to its graveyard; the 2/2 reads 7/7 with trample', () => {
    const { g, keeper, bears } = kept();
    expect(g.state.cards[keeper]?.zone.kind).toBe('graveyard');
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(7);
    expect(d.keywords.has('trample')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = kept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
