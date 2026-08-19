// `Acid Rain` — the subtype wipe is DERIVED: Dryad Arbor (a land creature
// that IS a Forest) dies with the Forest; the Mountain stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ACID_RAIN_SCRIPT } from './acidRain';
import { ACID_RAIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; forest: InstanceId; arbor: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Acid Rain'], ['Forest', 'Dryad Arbor', 'Mountain']],
    scripts: createRegistry([ACID_RAIN_SCRIPT]),
  });
  const forest = put(g, 'p2', 'Forest');
  const arbor = put(g, 'p2', 'Dryad Arbor');
  const mountain = put(g, 'p2', 'Mountain');
  settle(g);
  const spell = put(g, 'p1', 'Acid Rain', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, forest, arbor, mountain };
}

describe('Acid Rain', () => {
  test('the Forest AND the Dryad Arbor die; the Mountain stands', () => {
    const { g, forest, arbor, mountain } = board();
    expect(g.state.cards[forest]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[arbor]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mountain]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ACID_RAIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ACID_RAIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ACID_RAIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
