// `Savage Surge` — the tapped target pumps and stands up.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SAVAGE_SURGE_SCRIPT } from './savageSurge';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function surged(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Savage Surge', 'Grizzly Bears'], []],
    scripts: createRegistry([SAVAGE_SURGE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // Tapped AFTER the untap step has passed, so the spell does the standing.
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  const spell = put(g, 'p1', 'Savage Surge', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Savage Surge', () => {
  test('the target reads 4/4 and stands untapped', () => {
    const { g, bears } = surged();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = surged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
