// `Borrowing the East Wind` — X to each HORSEMANSHIP creature and each
// player: nobody in the fixture pool has horsemanship, so the players alone
// take it — the negative half of Squall Line's keyword filter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BORROWING_THE_EAST_WIND_SCRIPT } from './borrowingTheEastWind';
import { BORROWING_THE_EAST_WIND } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blown(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Borrowing the East Wind'], ['Grizzly Bears']],
    scripts: createRegistry([BORROWING_THE_EAST_WIND_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Borrowing the East Wind', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  settle(g);
  return { g, bears };
}

describe('Borrowing the East Wind', () => {
  test('X=3 hits BOTH players; the horsemanship-less creature is spared', () => {
    const { g, bears } = blown();
    expect(g.state.players['p1']?.life).toBe(37);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.cards[bears]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BORROWING_THE_EAST_WIND.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BORROWING_THE_EAST_WIND.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BORROWING_THE_EAST_WIND.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
