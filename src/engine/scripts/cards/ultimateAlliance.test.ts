// `Ultimate Alliance` — damage equal to MY creature count, and the count
// includes the target when the target is mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ULTIMATE_ALLIANCE_SCRIPT } from './ultimateAlliance';
import { ULTIMATE_ALLIANCE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Ultimate Alliance';
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan'; // 6/6 — survives small counts

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function allied(mine: number): { g: Game; victim: InstanceId } {
  const deck = [SPELL];
  for (let i = 0; i < mine; i++) deck.push(BEARS);
  const g = startedGame({
    players: 2,
    decks: [deck, [TITAN]],
    scripts: createRegistry([ULTIMATE_ALLIANCE_SCRIPT]),
  });
  for (let i = 0; i < mine; i++) put(g, 'p1', BEARS);
  const victim = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Ultimate Alliance', () => {
  test('three creatures of mine is 3 damage', () => {
    const { g, victim } = allied(3);
    expect(g.state.cards[victim]?.damage).toBe(3);
  });

  test('no creatures of mine is a true no-op', () => {
    const { g, victim } = allied(0);
    expect(g.state.cards[victim]?.damage).toBe(0);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ULTIMATE_ALLIANCE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ULTIMATE_ALLIANCE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ULTIMATE_ALLIANCE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = allied(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
