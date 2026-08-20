// `Diresight` — Cruel Truths' text on its own id: the loss lands before
// the ask, and keeping both to the graveyard still draws two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DIRESIGHT_SCRIPT } from './diresight';
import { DIRESIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function foreseen(): { g: Game; revealed: InstanceId[]; mine: number } {
  const g = startedGame({
    players: 2,
    decks: [['Diresight'], ['Grizzly Bears']],
    scripts: createRegistry([DIRESIGHT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Diresight', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed, mine };
}

describe('Diresight', () => {
  test('the loss lands before the ask; binning both still draws two', () => {
    const { g, revealed, mine } = foreseen();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    const hand = g.state.zones.hand['p1'] ?? [];
    expect(hand.length).toBe(mine + 2);
    for (const id of revealed) expect(hand).not.toContain(id);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DIRESIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DIRESIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DIRESIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = foreseen();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
