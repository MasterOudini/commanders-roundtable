// `Thriss, Nantuko Primus` — the largest single grant the arc has shipped,
// asserted on the DERIVED P/T and ended by the next cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { THRISS_NANTUKO_PRIMUS_SCRIPT } from './thrissNantukoPrimus';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const THRISS = 'Thriss, Nantuko Primus';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[THRISS, BEARS], []],
    scripts: createRegistry([THRISS_NANTUKO_PRIMUS_SCRIPT]),
  });
  const thriss = put(g, 'p1', THRISS);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  // The cost carries {T}, so the Nantuko must have been under its
  // controller's command since their turn began.
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: thriss, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Thriss, Nantuko Primus', () => {
  test('a 2/2 becomes a 7/7, and the next cleanup takes it back', () => {
    const { g, bears } = pumped();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(7);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(7);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = pumped();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
