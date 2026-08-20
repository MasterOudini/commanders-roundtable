// `Engulf the Shore` — two Islands bounce toughness ≤ 2 on BOTH sides;
// the 6/6 stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ENGULF_THE_SHORE_SCRIPT } from './engulfTheShore';
import { ENGULF_THE_SHORE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function engulfed(): { g: Game; mine: InstanceId; theirs: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Engulf the Shore', 'Island', 'Island', 'Grizzly Bears'],
      ['Grizzly Bears', 'Colossal Dreadmaw'],
    ],
    scripts: createRegistry([ENGULF_THE_SHORE_SCRIPT]),
  });
  put(g, 'p1', 'Island');
  put(g, 'p1', 'Island');
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Engulf the Shore', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, maw };
}

describe('Engulf the Shore', () => {
  test('two Islands bounce both 2/2s; the 6/6 stands', () => {
    const { g, mine, theirs, maw } = engulfed();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ENGULF_THE_SHORE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ENGULF_THE_SHORE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ENGULF_THE_SHORE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = engulfed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
