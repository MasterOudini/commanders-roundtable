// D301 - the mass pump: "Creatures you control get +N/+N [and gain KW] until end
// of turn" is a self clause the consumer applies to every creature its controller
// controls as the board derives at resolution. Proven by the parse, by the
// classifier's one-shot shape, and by real cards cast from the ORACLE with no
// script: Charge lifts both of the caster's creatures and neither of the
// opponent's; Overrun's trample rides the same carrier; both end at cleanup.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { oneShotRowShape } from '../data/primitives';
import { createRegistry } from './scripts/registry';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

describe('the mass pump parses as a self clause (D301)', () => {
  test('the three shapes are admitted and consume no target', () => {
    const plain = parseEffects('Creatures you control get +1/+1 until end of turn.', 'X', true);
    expect(plain.mode).toBe('auto');
    expect(plain.effects[0]?.kind).toBe('massPump');
    expect(plain.effects[0]?.self).toBe(true);
    expect(plain.effects[0]?.targetIndex).toBe(-1);
    const rider = parseEffects('Creatures you control get +3/+3 and gain trample until end of turn.', 'X', true);
    expect(rider.effects[0]?.keywords).toEqual(['trample']);
    expect(parseEffects('Creatures you control gain haste until end of turn.', 'X', true).mode).toBe('auto');
  });

  test("an opponent's creatures, a subtype scope and a permanent grant stay out", () => {
    expect(parseEffects('Creatures your opponents control get -1/-1 until end of turn.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('Elf creatures you control get +1/+1 until end of turn.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects('Creatures you control get +1/+1.', 'X', true).mode).not.toBe('auto');
  });
});

describe('the activated one-shot row shape (D301)', () => {
  test('a self pump or grant behind a cost is a row shape; a trigger, a target or a static is not', () => {
    expect(oneShotRowShape('{R}: This creature gets +1/+0 until end of turn.', 'Fiery Hellhound')).toBe(true);
    expect(oneShotRowShape('{2}: Henge Guardian gains trample until end of turn.', 'Henge Guardian')).toBe(true);
    expect(oneShotRowShape('{T}: Creatures you control gain haste until end of turn.', 'Crashing Drawbridge')).toBe(true);
    expect(oneShotRowShape('{2}, {T}: All creatures get -1/-0 until end of turn.', 'Bone Flute')).toBe(true);
    expect(oneShotRowShape('Whenever this creature attacks, it gets +2/+0 until end of turn.', 'Lurking Nightstalker')).toBe(false);
    expect(oneShotRowShape('{1}: Target creature gets +1/+1 until end of turn.', 'X')).toBe(false);
    expect(oneShotRowShape('Creatures you control have haste.', 'X')).toBe(false);
    expect(oneShotRowShape('{R}, {T}: Attacking creatures gain first strike until end of turn.', 'Akki Coalflinger')).toBe(false);
  });
});

const BEARS = 'Grizzly Bears';
const EEL = 'Coral Eel';
const CYCLOPS = 'Cyclops of One-Eyed Pass';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

type Mana = readonly (readonly ['W' | 'U' | 'B' | 'R' | 'G' | 'C', number])[];

function cast(spell: string, mana: Mana): { g: Game; bears: InstanceId; eel: InstanceId; theirs: InstanceId } {
  const g = startedGame({ players: 2, decks: [[spell, BEARS, EEL], [CYCLOPS]], scripts: createRegistry([]) });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', BEARS);
  const eel = put(g, 'p1', EEL);
  const theirs = put(g, 'p2', CYCLOPS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const card = put(g, 'p1', spell, 'hand');
  for (const [sym, n] of mana) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  settle(g);
  return { g, bears, eel, theirs };
}

describe('the cards run from the oracle alone (D301)', () => {
  test("Charge lifts both of the caster's creatures and neither of the opponent's", () => {
    const { g, bears, eel, theirs } = cast('Charge', [['W', 1]]);
    expect(pt(g, bears)).toEqual([3, 3]);
    expect(pt(g, eel)).toEqual([3, 2]);
    expect(pt(g, theirs)).toEqual([5, 2]);
  });

  test('Overrun adds +3/+3 and trample, and it all ends at cleanup', () => {
    const { g, bears, theirs } = cast('Overrun', [['G', 3], ['C', 2]]);
    expect(pt(g, bears)).toEqual([5, 5]);
    expect(kw(g, bears).has('trample')).toBe(true);
    expect(kw(g, theirs).has('trample')).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(pt(g, bears)).toEqual([2, 2]);
    expect(kw(g, bears).has('trample')).toBe(false);
  });
});
