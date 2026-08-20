// `Elvish Herder` — {G} grants DERIVED trample for the turn; cleanup takes
// it back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { ELVISH_HERDER_SCRIPT } from './elvishHerder';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function herded(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Elvish Herder', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ELVISH_HERDER_SCRIPT]),
  });
  const herder = put(g, 'p1', 'Elvish Herder');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: herder, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Elvish Herder', () => {
  test('{G} grants DERIVED trample, and the next cleanup ends it', () => {
    const { g, bears } = herded();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('trample')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('trample')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = herded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
