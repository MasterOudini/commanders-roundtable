// `Dauthi Embrace` — {B}{B} grants DERIVED shadow for the turn, from an
// enchantment that never taps; cleanup takes it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { DAUTHI_EMBRACE_SCRIPT } from './dauthiEmbrace';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function embraced(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dauthi Embrace', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([DAUTHI_EMBRACE_SCRIPT]),
  });
  const embrace = put(g, 'p1', 'Dauthi Embrace');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: embrace, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Dauthi Embrace', () => {
  test('{B}{B} grants DERIVED shadow, and the next cleanup ends it', () => {
    const { g, bears } = embraced();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('shadow')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('shadow')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = embraced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
