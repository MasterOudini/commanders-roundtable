// `Sphinx's Insight` — two cards always; the Addendum 2 life only when cast
// in MY main phase.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SPHINXS_INSIGHT_SCRIPT } from './sphinxsInsight';
import { SPHINX_S_INSIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = "Sphinx's Insight";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function cast(when: 'myMain' | 'theirMain'): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([SPHINXS_INSIGHT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  if (when === 'myMain') {
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
      60_000,
    );
  } else {
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
      60_000,
    );
  }
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, logAt };
}

describe("Sphinx's Insight", () => {
  test('cast in my main phase: two cards and 2 life', () => {
    const { g, logAt } = cast('myMain');
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test("cast in the opponent's main phase: two cards, no life", () => {
    const { g, logAt } = cast('theirMain');
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SPHINX_S_INSIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SPHINX_S_INSIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SPHINX_S_INSIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('myMain');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
