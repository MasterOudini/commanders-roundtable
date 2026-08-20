// `Demon's Due` — the loss lands first, the scry asks, and the two drawn
// cards are the two the player just kept on top.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEMONS_DUE_SCRIPT } from './demonsDue';
import { DEMON_S_DUE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function owed(): { g: Game; revealed: InstanceId[]; mine: number } {
  const g = startedGame({
    players: 2,
    decks: [["Demon's Due"], ['Grizzly Bears']],
    scripts: createRegistry([DEMONS_DUE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Demon's Due", 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed, mine };
}

describe("Demon's Due", () => {
  test('the loss lands BEFORE the ask; keeping both draws exactly those two', () => {
    const { g, revealed, mine } = owed();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    const hand = g.state.zones.hand['p1'] ?? [];
    expect(hand.length).toBe(mine + 2);
    for (const id of revealed) expect(hand).toContain(id);
  });

  test('bottoming both still draws two (the next two down)', () => {
    const { g, revealed, mine } = owed();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    const hand = g.state.zones.hand['p1'] ?? [];
    expect(hand.length).toBe(mine + 2);
    for (const id of revealed) expect(hand).not.toContain(id);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEMON_S_DUE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEMON_S_DUE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEMON_S_DUE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = owed();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
