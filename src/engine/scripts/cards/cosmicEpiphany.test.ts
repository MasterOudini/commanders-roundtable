// `Cosmic Epiphany` — draw = my graveyard's instants + sorceries: one of
// each beside a creature pays two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { COSMIC_EPIPHANY_SCRIPT } from './cosmicEpiphany';
import { COSMIC_EPIPHANY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function epiphanized(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Cosmic Epiphany', 'Lightning Bolt', 'Culling Sun', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([COSMIC_EPIPHANY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  for (const name of ['Lightning Bolt', 'Culling Sun', 'Grizzly Bears']) {
    const id = put(g, 'p1', name, 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
  }
  const spell = put(g, 'p1', 'Cosmic Epiphany', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Cosmic Epiphany', () => {
  test('an instant + a sorcery + a creature in the graveyard pay TWO', () => {
    const { g, before } = epiphanized();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = COSMIC_EPIPHANY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, COSMIC_EPIPHANY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(COSMIC_EPIPHANY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = epiphanized();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
