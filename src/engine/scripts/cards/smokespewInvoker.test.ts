// `Smokespew Invoker` — -3/-3 until cleanup; the SBA kills a 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SMOKESPEW_INVOKER_SCRIPT } from './smokespewInvoker';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function invoked(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Smokespew Invoker'], ['Grizzly Bears']],
    scripts: createRegistry([SMOKESPEW_INVOKER_SCRIPT]),
  });
  const invoker = put(g, 'p1', 'Smokespew Invoker');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 8 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: invoker, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Smokespew Invoker', () => {
  test('the -3/-3 kills the 2/2 through the SBA', () => {
    const { g, bears } = invoked();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = invoked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
