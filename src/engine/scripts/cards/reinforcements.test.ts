// `Reinforcements` — three creature cards leave my graveyard for the top of
// my library; an instant in the graveyard is refused; zero targets resolves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { REINFORCEMENTS_SCRIPT } from './reinforcements';
import { REINFORCEMENTS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Reinforcements';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';
const CHILD = 'Child of Night';
const SNUFF = 'Spell Snuff';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; spell: InstanceId; a: InstanceId; b: InstanceId; c: InstanceId; snuff: InstanceId; libBefore: number; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, NIGHTHAWK, CHILD, SNUFF], []],
    scripts: createRegistry([REINFORCEMENTS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const a = put(g, 'p1', BEARS, 'graveyard');
  const b = put(g, 'p1', NIGHTHAWK, 'graveyard');
  const c = put(g, 'p1', CHILD, 'graveyard');
  const snuff = put(g, 'p1', SNUFF, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  const libBefore = (g.state.zones.library['p1'] ?? []).length;
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, spell, a, b, c, snuff, libBefore, logAt };
}

describe('Reinforcements (up to three graveyard targets)', () => {
  test('three creature cards go from my graveyard to the top of my library', () => {
    const { g, a, b, c, libBefore } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }, { kind: 'card', id: c }] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('library');
    expect(g.state.cards[b]?.zone.kind).toBe('library');
    expect(g.state.cards[c]?.zone.kind).toBe('library');
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib.length).toBe(libBefore + 3);
    expect(lib.slice(lib.length - 3)).toEqual(expect.arrayContaining([a, b, c]));
  });

  test('an instant in the graveyard is refused', () => {
    const { g, snuff } = aimed();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: snuff }] });
    expect(res.ok).toBe(false);
  });

  test('zero targets: resolves without fizzling', () => {
    const { g, spell, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = REINFORCEMENTS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, REINFORCEMENTS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(REINFORCEMENTS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, a, b } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }, { kind: 'card', id: b }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
