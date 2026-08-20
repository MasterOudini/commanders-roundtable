// `Natural Obsolescence` — the artifact goes UNDER its owner's library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NATURAL_OBSOLESCENCE_SCRIPT } from './naturalObsolescence';
import { NATURAL_OBSOLESCENCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function obsoleted(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Natural Obsolescence'], ['Sol Ring']],
    scripts: createRegistry([NATURAL_OBSOLESCENCE_SCRIPT]),
  });
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Natural Obsolescence', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: ring }] }),
  );
  settle(g);
  return { g, ring };
}

describe('Natural Obsolescence', () => {
  test("the Ring lands on the BOTTOM of its owner's library", () => {
    const { g, ring } = obsoleted();
    const card = g.state.cards[ring];
    expect(card?.zone.kind).toBe('library');
    expect(card?.zone.kind === 'library' && card.zone.player).toBe('p2');
    expect((g.state.zones.library['p2'] ?? [])[0]).toBe(ring);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NATURAL_OBSOLESCENCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NATURAL_OBSOLESCENCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NATURAL_OBSOLESCENCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = obsoleted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
