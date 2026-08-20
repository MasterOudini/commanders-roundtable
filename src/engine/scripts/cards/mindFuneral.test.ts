// `Mind Funeral` — the run stops at the FOURTH land; the top is engineered
// so the count is exact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MIND_FUNERAL_SCRIPT } from './mindFuneral';
import { MIND_FUNERAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { faceOf } from '../../oracle';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function funeraled(): { g: Game; milled: number } {
  const g = startedGame({
    players: 2,
    decks: [['Mind Funeral'], ['Grizzly Bears']],
    scripts: createRegistry([MIND_FUNERAL_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mind Funeral', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  const graveAt = (g.state.zones.graveyard['p2'] ?? []).length;
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  const milled = (g.state.zones.graveyard['p2'] ?? []).length - graveAt;
  return { g, milled };
}

describe('Mind Funeral', () => {
  test('mills through the fourth land exactly', () => {
    const { g, milled } = funeraled();
    // p2's library is basics padding around one Bears — count the lands in
    // the milled run off the graveyard itself: exactly 4 (or the library
    // emptied first, which padding makes impossible here).
    const grave = g.state.zones.graveyard['p2'] ?? [];
    const landCount = grave.filter((id) => {
      const card = g.state.cards[id];
      const oc = card && g.deps.oracle.byPrinting(card.printingId);
      return oc ? faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land') : false;
    }).length;
    expect(landCount).toBe(4);
    expect(milled).toBeGreaterThanOrEqual(4);
    // The reveal is asserted ON THE LOG — the zone move cleared revealedTo
    // on the cards themselves (the Beast Hunt lesson, D199).
    expect(
      g.log.some((e) => e.body.t === 'CardsRevealed' && e.body.cards.length === milled),
    ).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MIND_FUNERAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MIND_FUNERAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MIND_FUNERAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = funeraled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
