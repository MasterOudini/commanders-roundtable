// `Molecular Modifier` — my begin-combat asks; +1/+0 and derived first
// strike until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOLECULAR_MODIFIER_SCRIPT } from './molecularModifier';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function modified(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Molecular Modifier', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([MOLECULAR_MODIFIER_SCRIPT]),
  });
  put(g, 'p1', 'Molecular Modifier');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Molecular Modifier', () => {
  test('+1/+0 and first strike until cleanup', () => {
    const { g, bears } = modified();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(2);
    expect(d.keywords.has('firstStrike')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const later = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(later.power).toBe(2);
    expect(later.keywords.has('firstStrike')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = modified();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
