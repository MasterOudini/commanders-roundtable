// D479 - THE TRIBAL TARGET. `target Knight you control`, `another target Vampire you control`, `target Zombie creature`:
// a capitalised noun after `target` is a subtype in print (D298 read it before `card`), and a permanent named by its
// subtype alone is any permanent carrying it (CR 205.3d). targetParse enforces it through `restrict.subtypesAll` (the
// engine checks it in `targets.ts` since D297); the effect rules, matching under the `i` flag, read the clause through
// a fold to the marker noun `#sub#` and keep the printed text. What is proven here: the specs (kinds, the subtype, the
// controller, `another`), the effect reading with its printed text, and the refusals - a plural, a name, a noun before
// another capitalised word.
import { describe, expect, test } from 'vitest';
import { parseEffects } from './effectParse';
import { parseTargetClauses } from './targetParse';

describe('D479 - the tribal target', () => {
  test('a subtype noun names a permanent of that subtype; with `creature` a creature', () => {
    const a = parseTargetClauses('Put a +1/+1 counter on another target Vampire you control.');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kinds: ['permanent'], controller: 'you', restrict: { subtypesAll: ['Vampire'] }, another: true, confident: true, unenforced: [] });
    const k = parseTargetClauses('Destroy target Knight.');
    expect(k[0]).toMatchObject({ kinds: ['permanent'], controller: 'any', restrict: { subtypesAll: ['Knight'] }, confident: true });
    const z = parseTargetClauses('Target Zombie creature gets +2/+2 until end of turn.');
    expect(z[0]).toMatchObject({ kinds: ['creature'], restrict: { subtypesAll: ['Zombie'] }, confident: true });
  });

  test('the effect rules read the clause and keep its printed text', () => {
    const p = parseEffects('Put a +1/+1 counter on another target Vampire you control.', '~', true);
    expect(p.mode).toBe('auto');
    expect(p.effects[0]?.kind).toBe('putCounters');
    expect(p.effects[0]?.text).toBe('Put a +1/+1 counter on another target Vampire you control.');
    expect(p.effects[0]?.targetIndex).toBe(0);
    const d = parseEffects('Destroy target Knight.', '~', true);
    expect(d.mode).toBe('auto');
    expect(d.effects[0]?.kind).toBe('destroy');
    const t = parseEffects('Target Merfolk you control gets +1/+1 until end of turn.', '~', true);
    expect(t.mode).toBe('auto');
  });

  test('the explicit nouns keep their kinds: a Wall is a creature, an Aura an enchantment, a Forest a land', () => {
    expect(parseTargetClauses('Destroy target Wall.')[0]?.kinds).toEqual(['creature']);
    expect(parseTargetClauses('Destroy target Aura.')[0]?.kinds).toEqual(['enchantment']);
    expect(parseTargetClauses('Destroy target Forest.')[0]?.kinds).toEqual(['land']);
  });

  test('the refusals stand: a plural, a card name, a noun before a capitalised word', () => {
    expect(parseTargetClauses('Destroy target Knights.')[0]?.confident).toBe(false);
    expect(parseTargetClauses('Destroy target Syr Elenora.')[0]?.confident).toBe(false);
    expect(parseEffects('Destroy target Knights.', '~', true).mode).toBe('manual');
    expect(parseEffects('Destroy target Syr Elenora.', '~', true).mode).toBe('manual');
  });
});
