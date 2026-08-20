// `Borrowing 100,000 Arrows` — the count is the TARGET's TAPPED creatures:
// one tapped, one upright pays one draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BORROWING_ARROWS_SCRIPT } from './borrowingArrows';
import { BORROWING_100_000_ARROWS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function borrowed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Borrowing 100,000 Arrows'], ['Grizzly Bears', 'Grizzly Bears']],
    scripts: createRegistry([BORROWING_ARROWS_SCRIPT]),
  });
  const tapped = put(g, 'p2', 'Grizzly Bears');
  const upright = put(g, 'p2', 'Grizzly Bears');
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [tapped], tapped: true }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Borrowing 100,000 Arrows', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  void upright;
  return { g, before };
}

describe('Borrowing 100,000 Arrows', () => {
  test('one tapped + one upright creature pays exactly ONE draw', () => {
    const { g, before } = borrowed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BORROWING_100_000_ARROWS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BORROWING_100_000_ARROWS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BORROWING_100_000_ARROWS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = borrowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
