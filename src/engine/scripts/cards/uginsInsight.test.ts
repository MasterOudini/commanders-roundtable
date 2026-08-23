// `Ugin's Insight` — scry X then draw three, with BOTH branches pinned: X=0
// raises no ask and still draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UGINS_INSIGHT_SCRIPT } from './uginsInsight';
import { UGIN_S_INSIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = "Ugin's Insight";
const TITAN = 'Grave Titan'; // mv 6
const RING = 'Sol Ring'; // mv 1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function cast(board: readonly string[]): { g: Game; since: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...board], []],
    scripts: createRegistry([UGINS_INSIGHT_SCRIPT]),
  });
  board.forEach((n) => put(g, 'p1', n));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  return { g, since };
}

describe("Ugin's Insight", () => {
  test('a mana value 6 permanent scries SIX, then the rider draws three', () => {
    const { g, since } = cast([TITAN, RING]);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(6);
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(drawn(g, since)).toBe(3);
  });

  test('an EMPTY board is X=0: no ask at all, and it still draws three', () => {
    const { g, since } = cast([]);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(drawn(g, since)).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UGIN_S_INSIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UGIN_S_INSIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UGIN_S_INSIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast([]);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
