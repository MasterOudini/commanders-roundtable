// `Skarrg, the Rage Pits` — the +1/+1-and-trample grant rides the carrier
// and ends at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKARRG_THE_RAGE_PITS_SCRIPT } from './skarrgTheRagePits';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raged(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Skarrg, the Rage Pits', 'Grizzly Bears'], []],
    scripts: createRegistry([SKARRG_THE_RAGE_PITS_SCRIPT]),
  });
  const land = put(g, 'p1', 'Skarrg, the Rage Pits');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Skarrg, the Rage Pits', () => {
  test('the Bears gets +1/+1 and trample until cleanup', () => {
    const { g, bears } = raged();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.keywords.has('trample')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    const later = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(later.power).toBe(2);
    expect(later.keywords.has('trample')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = raged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
