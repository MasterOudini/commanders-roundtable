// `Bloodcurdling Scream` — the X pump: X=3 makes the 2/2 a 5/2 until
// cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLOODCURDLING_SCREAM_SCRIPT } from './bloodcurdlingScream';
import { BLOODCURDLING_SCREAM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function screamed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Bloodcurdling Scream', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BLOODCURDLING_SCREAM_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Bloodcurdling Scream', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Bloodcurdling Scream', () => {
  test('X=3 makes the 2/2 a 5/2 until cleanup', () => {
    const { g, bears } = screamed();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(5);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLOODCURDLING_SCREAM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLOODCURDLING_SCREAM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLOODCURDLING_SCREAM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = screamed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
