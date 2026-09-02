// `Dauntless Onslaught` — the up-to-N shape end to end: two targets pump
// both, one target pumps one, ZERO targets is a legal cast that resolves
// without fizzling, and three targets are refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DAUNTLESS_ONSLAUGHT_SCRIPT } from './dauntlessOnslaught';
import { DAUNTLESS_ONSLAUGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Dauntless Onslaught';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([DAUNTLESS_ONSLAUGHT_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function aimed(): { g: Game; spell: InstanceId; bears: InstanceId; hawk: InstanceId; theirs: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, NIGHTHAWK], [BEARS]],
    scripts: createRegistry([DAUNTLESS_ONSLAUGHT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS);
  const hawk = put(g, 'p1', NIGHTHAWK);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, bears, hawk, theirs, logAt };
}

describe('Dauntless Onslaught (up to two targets)', () => {
  test('two targets: both get +2/+2 until cleanup', () => {
    const { g, bears, hawk, theirs } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 4 });
    expect(pt(g, hawk)).toEqual({ power: 4, toughness: 5 });
    expect(pt(g, theirs)).toEqual({ power: 2, toughness: 2 });
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('one target: only that one', () => {
    const { g, bears, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(pt(g, hawk)).toEqual({ power: 4, toughness: 5 });
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('zero targets: a legal cast that resolves, not a fizzle', () => {
    const { g, spell, bears, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('three targets are refused', () => {
    const { g, bears, hawk, theirs } = aimed();
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }, { kind: 'card', id: theirs }],
    });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DAUNTLESS_ONSLAUGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DAUNTLESS_ONSLAUGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DAUNTLESS_ONSLAUGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, bears, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
