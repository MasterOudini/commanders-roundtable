// `Deathless Angel` — {W}{W} grants DERIVED indestructible for the turn;
// cleanup takes it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { DEATHLESS_ANGEL_SCRIPT } from './deathlessAngel';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blessed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Deathless Angel', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([DEATHLESS_ANGEL_SCRIPT]),
  });
  const angel = put(g, 'p1', 'Deathless Angel');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: angel, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Deathless Angel', () => {
  test('{W}{W} grants DERIVED indestructible, and the next cleanup ends it', () => {
    const { g, bears } = blessed();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('indestructible')).toBe(
      true,
    );
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('indestructible')).toBe(
      false,
    );
  });

  test('replays to the same hash', () => {
    const { g } = blessed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
