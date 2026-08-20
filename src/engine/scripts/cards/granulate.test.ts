// `Granulate` — nonland artifacts at mana value 4 or less die; the
// artifact LAND and the 1/1 artifact flyer split the two filters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GRANULATE_SCRIPT } from './granulate';
import { GRANULATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ground(): { g: Game; ring: InstanceId; strix: InstanceId; citadel: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Granulate', 'Sol Ring'], ['Baleful Strix', 'Darksteel Citadel']],
    scripts: createRegistry([GRANULATE_SCRIPT]),
  });
  const ring = put(g, 'p1', 'Sol Ring');
  const strix = put(g, 'p2', 'Baleful Strix');
  const citadel = put(g, 'p2', 'Darksteel Citadel');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Granulate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ring, strix, citadel };
}

describe('Granulate', () => {
  test('Sol Ring and the Strix die; the artifact LAND is exempt by the word nonland', () => {
    const { g, ring, strix, citadel } = ground();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GRANULATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GRANULATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GRANULATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ground();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
