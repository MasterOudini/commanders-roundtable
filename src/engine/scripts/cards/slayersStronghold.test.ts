// `Slayers' Stronghold` — the two-keyword grant: +2/+0, vigilance AND haste,
// all gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SLAYERS_STRONGHOLD_SCRIPT } from './slayersStronghold';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function strengthened(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Slayers' Stronghold", 'Grizzly Bears'], []],
    scripts: createRegistry([SLAYERS_STRONGHOLD_SCRIPT]),
  });
  const land = put(g, 'p1', "Slayers' Stronghold");
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe("Slayers' Stronghold", () => {
  test('+2/+0 with vigilance and haste, until cleanup', () => {
    const { g, bears } = strengthened();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(2);
    expect(d.keywords.has('vigilance')).toBe(true);
    expect(d.keywords.has('haste')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    const later = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(later.power).toBe(2);
    expect(later.keywords.has('vigilance')).toBe(false);
    expect(later.keywords.has('haste')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = strengthened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
