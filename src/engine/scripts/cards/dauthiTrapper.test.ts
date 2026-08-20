// `Dauthi Trapper` — the {T} shadow grant; the tap costs the Trapper its
// turn (summoning sickness respected), so the game walks to turn 3 first.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { DAUTHI_TRAPPER_SCRIPT } from './dauthiTrapper';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function trapped(): { g: Game; trapper: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dauthi Trapper', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([DAUTHI_TRAPPER_SCRIPT]),
  });
  const trapper = put(g, 'p1', 'Dauthi Trapper');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: trapper, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, trapper, bears };
}

describe('Dauthi Trapper', () => {
  test('the tap grants DERIVED shadow and spends the Trapper', () => {
    const { g, trapper, bears } = trapped();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('shadow')).toBe(true);
    expect(g.state.cards[trapper]?.tapped).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('shadow')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = trapped();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
