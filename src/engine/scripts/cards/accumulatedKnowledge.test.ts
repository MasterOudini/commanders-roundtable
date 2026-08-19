// `Accumulated Knowledge` — the first NAME predicate: two copies in
// graveyards make the third draw three; none makes it a cantrip.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ACCUMULATED_KNOWLEDGE_SCRIPT } from './accumulatedKnowledge';
import { ACCUMULATED_KNOWLEDGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(inGraveyards: number): { g: Game; libBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Accumulated Knowledge', 'Accumulated Knowledge', 'Accumulated Knowledge', 'Grizzly Bears'],
      ['Accumulated Knowledge'],
    ],
    scripts: createRegistry([ACCUMULATED_KNOWLEDGE_SCRIPT]),
  });
  // Seed the graveyards: one in mine, one in the opponent's — ALL graveyards
  // count, which is the wording's whole point.
  if (inGraveyards >= 1) put(g, 'p1', 'Accumulated Knowledge', 'graveyard');
  if (inGraveyards >= 2) put(g, 'p2', 'Accumulated Knowledge', 'graveyard');
  settle(g);
  const spell = put(g, 'p1', 'Accumulated Knowledge', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  const libBefore = g.state.zones.library['p1']?.length ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, libBefore };
}

describe('Accumulated Knowledge', () => {
  test('with none in any graveyard it is a cantrip', () => {
    const { g, libBefore } = cast(0);
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 1);
  });

  test('two copies across BOTH graveyards make it draw three', () => {
    const { g, libBefore } = cast(2);
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ACCUMULATED_KNOWLEDGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ACCUMULATED_KNOWLEDGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ACCUMULATED_KNOWLEDGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
