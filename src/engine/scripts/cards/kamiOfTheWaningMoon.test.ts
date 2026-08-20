// `Kami of the Waning Moon` — a Spirit cast asks and grants derived
// fear; a plain cast asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { KAMI_OF_THE_WANING_MOON_SCRIPT } from './kamiOfTheWaningMoon';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function waned(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Kami of the Waning Moon', 'Bile Urchin', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([KAMI_OF_THE_WANING_MOON_SCRIPT]),
  });
  put(g, 'p1', 'Kami of the Waning Moon');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const urchin = put(g, 'p1', 'Bile Urchin', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: urchin, targets: [] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Kami of the Waning Moon', () => {
  test('the Spirit cast grants DERIVED fear, and cleanup ends it', () => {
    const { g, bears } = waned();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('fear')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('fear')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = waned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
