// `Healing Hands` — 4 life to the targeted player (the opponent, or me), and
// a card for me either way.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HEALING_HANDS_SCRIPT } from './healingHands';
import { HEALING_HANDS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Healing Hands';

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

function cast(target: 'p1' | 'p2'): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([HEALING_HANDS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: target }] }));
  settle(g);
  return { g, logAt };
}

describe('Healing Hands', () => {
  test('the opponent gains 4; I draw', () => {
    const { g, logAt } = cast('p2');
    expect(g.state.players['p2']?.life).toBe(44);
    expect(g.state.players['p1']?.life).toBe(40);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(drawsFor(g, 'p2', logAt)).toBe(0);
  });

  test('I may target myself: 4 life and the card', () => {
    const { g, logAt } = cast('p1');
    expect(g.state.players['p1']?.life).toBe(44);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HEALING_HANDS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HEALING_HANDS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HEALING_HANDS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('p2');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
