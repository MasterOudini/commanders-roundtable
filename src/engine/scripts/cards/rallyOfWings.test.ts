// `Rally of Wings` — everything untaps; only the flyer pumps.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RALLY_OF_WINGS_SCRIPT } from './rallyOfWings';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function winged(): { g: Game; flyer: InstanceId; walker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rally of Wings', 'Air Elemental', 'Grizzly Bears'], []],
    scripts: createRegistry([RALLY_OF_WINGS_SCRIPT]),
  });
  const flyer = put(g, 'p1', 'Air Elemental');
  const walker = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [flyer, walker], tapped: true }));
  const spell = put(g, 'p1', 'Rally of Wings', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flyer, walker };
}

describe('Rally of Wings', () => {
  test('both untap; only the flyer reads +2/+2', () => {
    const { g, flyer, walker } = winged();
    expect(g.state.cards[flyer]?.tapped).toBe(false);
    expect(g.state.cards[walker]?.tapped).toBe(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, flyer).power).toBe(6);
    expect(derive(g.state, ORACLE, g.deps.scripts, walker).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = winged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
