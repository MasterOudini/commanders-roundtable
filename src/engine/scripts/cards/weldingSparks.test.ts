// `Welding Sparks` — X is 3 PLUS my artifacts, so the floor is 3 and only MY
// artifacts count.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WELDING_SPARKS_SCRIPT } from './weldingSparks';
import { WELDING_SPARKS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Welding Sparks';
const TITAN = 'Grave Titan'; // 6/6 — survives, so the amount is readable
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(mine: number, theirs: number): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, RING, RING, RING],
      [TITAN, RING, RING, RING],
    ],
    scripts: createRegistry([WELDING_SPARKS_SCRIPT]),
  });
  const victim = put(g, 'p2', TITAN);
  for (let i = 0; i < mine; i += 1) put(g, 'p1', RING);
  for (let i = 0; i < theirs; i += 1) put(g, 'p2', RING);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Welding Sparks', () => {
  test('no artifacts at all still deals the floor of 3', () => {
    const { g, victim } = cast(0, 0);
    expect(g.state.cards[victim]?.damage).toBe(3);
  });

  test('two of MY artifacts make it 5', () => {
    const { g, victim } = cast(2, 0);
    expect(g.state.cards[victim]?.damage).toBe(5);
  });

  test("the OPPONENT's artifacts do not count", () => {
    const { g, victim } = cast(0, 3);
    expect(g.state.cards[victim]?.damage).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WELDING_SPARKS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WELDING_SPARKS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WELDING_SPARKS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(2, 0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
