// `Mabel's Mettle` — the first creature gets +2/+2, an optional second
// +1/+1; a single target is a legal cast (the "up to one other" clause now
// reads 0..1).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MABELS_METTLE_SCRIPT } from './mabelsMettle';
import { MABEL_S_METTLE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Mabel's Mettle";
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([MABELS_METTLE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function aimed(): { g: Game; bears: InstanceId; hawk: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, NIGHTHAWK], []],
    scripts: createRegistry([MABELS_METTLE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS);
  const hawk = put(g, 'p1', NIGHTHAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, bears, hawk, logAt };
}

describe("Mabel's Mettle (a required clause then an up-to-one)", () => {
  test('two targets: +2/+2 on the first, +1/+1 on the second', () => {
    const { g, bears, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
    expect(pt(g, hawk)).toEqual({ power: 3, toughness: 4 });
  });

  test('one target: a legal cast, +2/+2 alone', () => {
    const { g, bears, hawk, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
    expect(pt(g, hawk)).toEqual({ power: 2, toughness: 3 });
  });

  test('zero targets are refused (the first clause is required)', () => {
    const { g } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }).ok).toBe(false);
  });

  test('the same creature for both clauses is refused ("other" holds by construction)', () => {
    const { g, bears } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MABEL_S_METTLE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MABEL_S_METTLE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MABEL_S_METTLE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, bears, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
