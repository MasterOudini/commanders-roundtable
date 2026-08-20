// `Guardian of Solitude` — a Spirit cast asks for a target and grants
// flying; a non-Spirit cast asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { GUARDIAN_OF_SOLITUDE_SCRIPT } from './guardianOfSolitude';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function guarded(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Guardian of Solitude', 'Bile Urchin', 'Grizzly Bears', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([GUARDIAN_OF_SOLITUDE_SCRIPT]),
  });
  put(g, 'p1', 'Guardian of Solitude');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return { g, bears };
}

describe('Guardian of Solitude', () => {
  test('a Spirit cast asks, and the answer grants derived flying', () => {
    const { g, bears } = guarded();
    const urchin = put(g, 'p1', 'Bile Urchin', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: urchin, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(false);
  });

  test('a non-Spirit creature cast triggers nothing', () => {
    const { g, bears } = guarded();
    const plain = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: plain, targets: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears } = guarded();
    const urchin = put(g, 'p1', 'Bile Urchin', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: urchin, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
