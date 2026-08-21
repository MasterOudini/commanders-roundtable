// `Savage Swipe` — the power-2 biter pumps to 4 and kills the 1/3; a
// power-6 biter gets no pump and the 1/3 still dies to 6 — the CONDITION
// is what the two games tell apart.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SAVAGE_SWIPE_SCRIPT } from './savageSwipe';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swiped(biterName: string): { g: Game; biter: InstanceId; crab: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Savage Swipe', 'Grizzly Bears', 'Colossal Dreadmaw'],
      ['Riptide Crab'],
    ],
    scripts: createRegistry([SAVAGE_SWIPE_SCRIPT]),
  });
  const biter = put(g, 'p1', biterName);
  const crab = put(g, 'p2', 'Riptide Crab');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Savage Swipe', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: biter },
        { kind: 'card', id: crab },
      ],
    }),
  );
  settle(g);
  return { g, biter, crab };
}

describe('Savage Swipe', () => {
  test('the power-2 biter pumps to 4 and the 1/3 dies', () => {
    const { g, biter, crab } = swiped('Grizzly Bears');
    expect(g.state.cards[crab]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, biter).power).toBe(4);
  });

  test('a power-6 biter gets NO pump', () => {
    const { g, biter, crab } = swiped('Colossal Dreadmaw');
    expect(g.state.cards[crab]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, biter).power).toBe(6);
  });

  test('replays to the same hash', () => {
    const { g } = swiped('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
