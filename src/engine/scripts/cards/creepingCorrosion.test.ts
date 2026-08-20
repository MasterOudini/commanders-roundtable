// `Creeping Corrosion` — all artifacts die; Darksteel Citadel is an
// ARTIFACT land with indestructible and survives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CREEPING_CORROSION_SCRIPT } from './creepingCorrosion';
import { CREEPING_CORROSION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function corroded(): { g: Game; ring: InstanceId; citadel: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Creeping Corrosion'], ['Sol Ring', 'Darksteel Citadel']],
    scripts: createRegistry([CREEPING_CORROSION_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  const citadel = put(g, 'p2', 'Darksteel Citadel');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Creeping Corrosion', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ring, citadel };
}

describe('Creeping Corrosion', () => {
  test('the Ring dies; the indestructible artifact land survives', () => {
    const { g, ring, citadel } = corroded();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CREEPING_CORROSION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CREEPING_CORROSION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CREEPING_CORROSION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = corroded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
