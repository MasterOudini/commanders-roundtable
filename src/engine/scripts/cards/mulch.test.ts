// `Mulch` — four revealed: the lands land in hand, the rest in the
// graveyard, counted off the LOG's own reveal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MULCH_SCRIPT } from './mulch';
import { MULCH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { faceOf } from '../../oracle';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mulched(): { g: Game; hand0: number; grave0: number } {
  const g = startedGame({
    players: 2,
    decks: [['Mulch'], []],
    scripts: createRegistry([MULCH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mulch', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  const hand0 = (g.state.zones.hand['p1'] ?? []).length - 1; // the spell leaves on cast
  const grave0 = (g.state.zones.graveyard['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, hand0, grave0 };
}

describe('Mulch', () => {
  test('lands to hand, the rest to the graveyard, four moved in all', () => {
    const { g, hand0, grave0 } = mulched();
    const reveal = [...g.log]
      .reverse()
      .find((e) => e.body.t === 'CardsRevealed' && e.body.cards.length === 4);
    expect(reveal).toBeDefined();
    const revealed = reveal && reveal.body.t === 'CardsRevealed' ? reveal.body.cards : [];
    const lands = revealed.filter((id) => {
      const card = g.state.cards[id];
      const oc = card && g.deps.oracle.byPrinting(card.printingId);
      return oc ? faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land') : false;
    }).length;
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(hand0 + lands);
    // The graveyard also holds the resolved Mulch itself.
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(grave0 + (4 - lands) + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MULCH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MULCH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MULCH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mulched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
