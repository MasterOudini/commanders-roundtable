// `Refuse to Yield` — the tapped 2/2 stands up as a 4/9.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { REFUSE_TO_YIELD_SCRIPT } from './refuseToYield';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function refused(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Refuse to Yield', 'Grizzly Bears'], []],
    scripts: createRegistry([REFUSE_TO_YIELD_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  const spell = put(g, 'p1', 'Refuse to Yield', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Refuse to Yield', () => {
  test('the Bears reads 4/9 and stands untapped', () => {
    const { g, bears } = refused();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(4);
    expect(d.toughness).toBe(9);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = refused();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
