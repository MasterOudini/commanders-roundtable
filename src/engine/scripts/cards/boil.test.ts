// `Boil` — destroy all ISLANDS: both sides' Islands die, a Mountain stands.
// (Boiling Seas carries the same text on its own id, proven in its own
// suite.)

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BOIL_SCRIPT } from './boil';
import { BOIL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function boiled(): { g: Game; island: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Boil', 'Mountain'], ['Island']],
    scripts: createRegistry([BOIL_SCRIPT]),
  });
  const island = put(g, 'p2', 'Island');
  const mountain = put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Boil', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, island, mountain };
}

describe('Boil', () => {
  test('the Island dies; the Mountain stands', () => {
    const { g, island, mountain } = boiled();
    expect(g.state.cards[island]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mountain]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BOIL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BOIL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BOIL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = boiled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
