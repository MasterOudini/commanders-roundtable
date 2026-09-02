// `Withering Gaze` — "each Forest AND green card": a GREEN FOREST scores
// TWICE. The hand is built so a union reading (which would score it once)
// gives a different number from the correct one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WITHERING_GAZE_SCRIPT } from './witheringGaze';
import { WITHERING_GAZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Withering Gaze';
const FOREST = 'Forest'; // a Forest, and COLOURLESS — scores 1
const GREEN = 'Grizzly Bears'; // green, not a Forest — scores 1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [FOREST, GREEN]],
    scripts: createRegistry([WITHERING_GAZE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const before = idsIn(g, 'p1', 'hand').length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, drew: idsIn(g, 'p1', 'hand').length - before };
}

describe('Withering Gaze', () => {
  test("the opponent's hand is revealed to me", () => {
    const { g } = cast();
    const theirs = idsIn(g, 'p2', 'hand');
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((id) => g.state.cards[id]?.revealedTo.includes('p1'))).toBe(true);
  });

  test('I draw one per Forest AND one per green card', () => {
    const { g, drew } = cast();
    let expected = 0;
    for (const id of idsIn(g, 'p2', 'hand')) {
      // The hand is unchanged by this spell, so it can be recounted here.
      const oc = g.deps.oracle.byPrinting(g.state.cards[id]!.printingId);
      const face = oc?.faces?.[0];
      if (face?.typeLine.subtypes.includes('Forest')) expected += 1;
      if (face?.colors.includes('G')) expected += 1;
    }
    expect(drew).toBe(expected);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WITHERING_GAZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WITHERING_GAZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WITHERING_GAZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
