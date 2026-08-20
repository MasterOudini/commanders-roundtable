// `Cruel Truths` — surveil 2 with thenDraw:2, the flat 2 life emitted
// before the ask (it commutes).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CRUEL_TRUTHS_SCRIPT } from './cruelTruths';
import { CRUEL_TRUTHS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function told(): { g: Game; before: number; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Cruel Truths'], ['Grizzly Bears']],
    scripts: createRegistry([CRUEL_TRUTHS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cruel Truths', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, before, revealed };
}

describe('Cruel Truths', () => {
  test('the loss lands, the surveil asks, and the TWO draws ride the answer', () => {
    const { g, before, revealed } = told();
    expect(g.state.players['p1']?.life).toBe(38);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 2);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CRUEL_TRUTHS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CRUEL_TRUTHS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CRUEL_TRUTHS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = told();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
