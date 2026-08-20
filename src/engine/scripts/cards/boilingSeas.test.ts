// `Boiling Seas` — Boil's exact text on its own oracle id, proven on its
// own def.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BOILING_SEAS_SCRIPT } from './boilingSeas';
import { BOILING_SEAS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function boiled(): { g: Game; island: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Boiling Seas'], ['Island']],
    scripts: createRegistry([BOILING_SEAS_SCRIPT]),
  });
  const island = put(g, 'p2', 'Island');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Boiling Seas', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, island };
}

describe('Boiling Seas', () => {
  test('the Island dies to the sorcery twin', () => {
    const { g, island } = boiled();
    expect(g.state.cards[island]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BOILING_SEAS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BOILING_SEAS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BOILING_SEAS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = boiled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
