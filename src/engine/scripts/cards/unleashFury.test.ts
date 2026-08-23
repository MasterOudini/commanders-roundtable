// `Unleash Fury` — DOUBLE, not +2: a 2/2 becomes 4/2 and a 6/6 becomes 12/6,
// and toughness never moves. The second case is what tells doubling apart
// from any fixed pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNLEASH_FURY_SCRIPT } from './unleashFury';
import { UNLEASH_FURY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Unleash Fury';
const SMALL = 'Grizzly Bears'; // 2/2
const BIG = 'Grave Titan'; // 6/6

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function doubled(name: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, name], []],
    scripts: createRegistry([UNLEASH_FURY_SCRIPT]),
  });
  const victim = put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Unleash Fury', () => {
  test('a 2/2 becomes 4/2 — toughness untouched', () => {
    const { g, victim } = doubled(SMALL);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).toughness).toBe(2);
  });

  test('a 6/6 becomes 12/6 — it DOUBLES rather than adding a constant', () => {
    const { g, victim } = doubled(BIG);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(12);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).toughness).toBe(6);
  });

  test('the cleanup takes it back', () => {
    const { g, victim } = doubled(SMALL);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNLEASH_FURY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNLEASH_FURY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNLEASH_FURY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = doubled(SMALL);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
