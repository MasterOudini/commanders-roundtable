// `Valorous Charge` — the colour filter, and the card names no controller:
// an OPPONENT'S white creature gets it too, which is the case worth pinning.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VALOROUS_CHARGE_SCRIPT } from './valorousCharge';
import { VALOROUS_CHARGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Valorous Charge';
const WHITE = 'Serra Angel'; // {3}{W}{W} 4/4 — white
const GREEN = 'Grizzly Bears'; // {1}{G} 2/2 — not white

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function charged(): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  green: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, WHITE, GREEN], [WHITE]],
    scripts: createRegistry([VALOROUS_CHARGE_SCRIPT]),
  });
  const mine = put(g, 'p1', WHITE);
  const green = put(g, 'p1', GREEN);
  const theirs = put(g, 'p2', WHITE);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, green };
}

describe('Valorous Charge', () => {
  test("every WHITE creature gets +2/+0 — the opponent's included", () => {
    const { g, mine, theirs, green } = charged();
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(6);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(6);
    expect(derive(g.state, ORACLE, g.deps.scripts, green).power).toBe(2);
  });

  test('toughness is untouched', () => {
    const { g, mine } = charged();
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).toughness).toBe(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VALOROUS_CHARGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VALOROUS_CHARGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VALOROUS_CHARGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = charged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
