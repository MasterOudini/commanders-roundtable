// `Kiku's Shadow` — the self-bite on its second oracle id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { KIKUS_SHADOW_SCRIPT } from './kikusShadow';
import { KIKU_S_SHADOW } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shadowed(): { g: Game; spider: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Kiku's Shadow"], ['Giant Spider']],
    scripts: createRegistry([KIKUS_SHADOW_SCRIPT]),
  });
  const spider = put(g, 'p2', 'Giant Spider');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Kiku's Shadow", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: spider }] }));
  settle(g);
  return { g, spider };
}

describe("Kiku's Shadow", () => {
  test('the 2/4 marks its own 2 and stands', () => {
    const { g, spider } = shadowed();
    expect(g.state.cards[spider]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[spider]?.damage).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = KIKU_S_SHADOW.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, KIKU_S_SHADOW.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(KIKU_S_SHADOW.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = shadowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
