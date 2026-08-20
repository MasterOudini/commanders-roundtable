// `Dinotomaton` — the entry asks for a target; the chosen creature gains
// DERIVED menace for the turn and cleanup takes it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { DINOTOMATON_SCRIPT } from './dinotomaton';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function menaced(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dinotomaton', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([DINOTOMATON_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  put(g, 'p1', 'Dinotomaton');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Dinotomaton', () => {
  test('the entry grants DERIVED menace, and the next cleanup ends it', () => {
    const { g, bears } = menaced();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('menace')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('menace')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = menaced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
