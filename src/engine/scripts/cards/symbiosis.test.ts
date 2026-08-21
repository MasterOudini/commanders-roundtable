// `Symbiosis` — the counted pair as a PUMP: both named creatures grow, and
// the bonus is gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYMBIOSIS_SCRIPT } from './symbiosis';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(): { g: Game; a: InstanceId; b: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Symbiosis', BEARS, BEARS], []],
    scripts: createRegistry([SYMBIOSIS_SCRIPT]),
  });
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', BEARS);
  if (a === b) throw new Error('the deck must hold two distinct Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Symbiosis', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: a },
        { kind: 'card', id: b },
      ],
    }),
  );
  settle(g);
  return { g, a, b };
}

describe('Symbiosis', () => {
  test('both targets are 4/4', () => {
    const { g, a, b } = pumped();
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, b).power).toBe(4);
  });

  test('the bonus ends at cleanup, and it replays to the same hash', () => {
    const { g, a } = pumped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, a).power).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
