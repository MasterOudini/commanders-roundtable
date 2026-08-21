// `Risky Research` — the 2 life lands first, the surveil asks, the
// answer draws two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { RISKY_RESEARCH_SCRIPT } from './riskyResearch';
import { RISKY_RESEARCH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function researched(): { g: Game; mid: number; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Risky Research'], []],
    scripts: createRegistry([RISKY_RESEARCH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Risky Research', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, mid, revealed };
}

describe('Risky Research', () => {
  test('the loss lands first, the surveil asks, the answer draws two', () => {
    const { g, mid, revealed } = researched();
    expect(g.state.players['p1']?.life).toBe(38);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(2);
    expect(awaiting?.kind === 'scryChoice' && awaiting.thenDraw).toBe(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = RISKY_RESEARCH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, RISKY_RESEARCH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(RISKY_RESEARCH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = researched();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
