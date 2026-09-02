// `Peek` — the opponent's whole hand is revealed to me alone, and I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PEEK_SCRIPT } from './peek';
import { PEEK } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Peek';

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

function peeked(): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([PEEK_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, logAt };
}

describe('Peek', () => {
  test("every card of the opponent's hand is revealed to me, and I draw", () => {
    const { g, logAt } = peeked();
    const hand = g.state.zones.hand['p2'] ?? [];
    expect(hand.length).toBeGreaterThan(0);
    for (const id of hand) expect(g.state.cards[id]?.revealedTo.includes('p1')).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(drawsFor(g, 'p2', logAt)).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PEEK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PEEK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PEEK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = peeked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
