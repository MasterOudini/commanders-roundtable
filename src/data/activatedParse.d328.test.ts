// D328 - the three cost reads: "Activate only once each turn" (CR 602.5b),
// "Discard a card at random" and "Sacrifice a token".
import { describe, expect, it } from 'vitest';
import { parseActivatedAbilities } from './activatedParse';
import { parseManaCost } from './oracleParse';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D328 - the three cost reads', () => {
  it('reads "Activate only once each turn" as oncePerTurn, beside sorceryOnly', () => {
    const [a] = parse('{1}: This creature gets +1/+1 until end of turn. Activate only once each turn.');
    expect(a?.oncePerTurn).toBe(true);
    expect(a?.sorceryOnly).toBe(false);
    const [b] = parse('{T}: Draw a card. Activate only as a sorcery.');
    expect(b?.oncePerTurn).toBe(false);
    expect(b?.sorceryOnly).toBe(true);
    const [c] = parse('{2}: Draw a card. Activate this ability only once each turn.');
    expect(c?.oncePerTurn).toBe(true);
  });

  it('reads "Discard a card at random" as a random discard cost with no predicate', () => {
    const [a] = parse('{1}, Discard a card at random: Draw a card.');
    expect(a?.discardCost).toEqual({ count: 1, any: null, atRandom: true });
    expect(a?.payable).toBe(true);
    const [b] = parse('{1}, Discard a card: Draw a card.');
    expect(b?.discardCost).toEqual({ count: 1, any: null, atRandom: false });
    const [c] = parse('{1}, Discard two cards at random: Draw a card.');
    expect(c?.discardCost).toEqual({ count: 2, any: null, atRandom: true });
  });

  it('reads "Sacrifice a token" as a token predicate the sacrifice chooser checks', () => {
    const [a] = parse('{T}, Sacrifice a token: Draw a card.');
    expect(a?.sacrificeCost).toEqual({ count: 1, another: false, any: [{ supertypes: [], types: [], subtypes: [], colors: [], token: true }] });
    expect(a?.payable).toBe(true);
    const [b] = parse('{T}, Sacrifice a creature token: Draw a card.');
    expect(b?.sacrificeCost?.any[0]).toMatchObject({ types: ['Creature'], token: true });
    // The word is read by the sacrifice cost alone: a plain creature stays as it was.
    const [c] = parse('{T}, Sacrifice a creature: Draw a card.');
    expect(c?.sacrificeCost?.any[0]).toEqual({ supertypes: [], types: ['Creature'], subtypes: [], colors: [] });
    // "another creature or token" is two alternatives: a creature, or a token (Ice Cream Kitty).
    const [d] = parse('{2}, Sacrifice another creature or token: Draw a card.');
    expect(d?.sacrificeCost).toEqual({
      count: 1,
      another: true,
      any: [
        { supertypes: [], types: ['Creature'], subtypes: [], colors: [] },
        { supertypes: [], types: [], subtypes: [], colors: [], token: true },
      ],
    });
  });
});
