// `Last Caress` — the opponent loses 1, I gain 1, I draw; aimed at myself the
// life cancels and the card still comes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LAST_CARESS_SCRIPT } from './lastCaress';
import { LAST_CARESS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Last Caress';

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
    scripts: createRegistry([LAST_CARESS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: target }] }));
  settle(g);
  return { g, logAt };
}

describe('Last Caress', () => {
  test('the opponent loses 1, I gain 1 and draw', () => {
    const { g, logAt } = cast('p2');
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(41);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('aimed at myself: the life cancels, the card comes', () => {
    const { g, logAt } = cast('p1');
    expect(g.state.players['p1']?.life).toBe(40);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LAST_CARESS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LAST_CARESS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LAST_CARESS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast('p2');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
