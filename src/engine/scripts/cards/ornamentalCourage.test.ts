// `Ornamental Courage` — the tapped Bears straightens and reads 3/5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ORNAMENTAL_COURAGE_SCRIPT } from './ornamentalCourage';
import { ORNAMENTAL_COURAGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function couraged(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Ornamental Courage', 'Grizzly Bears'], []],
    scripts: createRegistry([ORNAMENTAL_COURAGE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  const spell = put(g, 'p1', 'Ornamental Courage', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }),
  );
  settle(g);
  return { g, bears };
}

describe('Ornamental Courage', () => {
  test('the tapped Bears straightens and reads 3/5', () => {
    const { g, bears } = couraged();
    expect(g.state.cards[bears]?.tapped).toBe(false);
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.toughness).toBe(5);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ORNAMENTAL_COURAGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ORNAMENTAL_COURAGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ORNAMENTAL_COURAGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = couraged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
