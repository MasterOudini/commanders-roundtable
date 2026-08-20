// `Goblin Motivator` — the {T} grant: derived haste for the turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { GOBLIN_MOTIVATOR_SCRIPT } from './goblinMotivator';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function motivated(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Goblin Motivator', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([GOBLIN_MOTIVATOR_SCRIPT]),
  });
  const motivator = put(g, 'p1', 'Goblin Motivator');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: motivator, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Goblin Motivator', () => {
  test('the tap grants DERIVED haste, and cleanup ends it', () => {
    const { g, bears } = motivated();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = motivated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
