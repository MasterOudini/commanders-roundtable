// `Mystic Repeal` — the enchantment goes UNDER its owner's library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MYSTIC_REPEAL_SCRIPT } from './mysticRepeal';
import { MYSTIC_REPEAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function repealed(): { g: Game; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mystic Repeal'], ['Captive Flame']],
    scripts: createRegistry([MYSTIC_REPEAL_SCRIPT]),
  });
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mystic Repeal', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: flame }] }),
  );
  settle(g);
  return { g, flame };
}

describe('Mystic Repeal', () => {
  test("lands on the BOTTOM of its owner's library", () => {
    const { g, flame } = repealed();
    const card = g.state.cards[flame];
    expect(card?.zone.kind).toBe('library');
    expect(card?.zone.kind === 'library' && card.zone.player).toBe('p2');
    // Bottom of the library is index 0.
    expect((g.state.zones.library['p2'] ?? [])[0]).toBe(flame);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MYSTIC_REPEAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MYSTIC_REPEAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MYSTIC_REPEAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = repealed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
