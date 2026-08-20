// `Forced March` — X = 2 fells the 2/2 and spares the 6/6.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FORCED_MARCH_SCRIPT } from './forcedMarch';
import { FORCED_MARCH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function marched(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Forced March'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([FORCED_MARCH_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Forced March', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  settle(g);
  return { g, bears, maw };
}

describe('Forced March', () => {
  test('X = 2: the 2/2 dies, the 6/6 stands', () => {
    const { g, bears, maw } = marched();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FORCED_MARCH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FORCED_MARCH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FORCED_MARCH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = marched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
