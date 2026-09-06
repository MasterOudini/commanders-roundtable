// D334 - the graveyard seam, continued: "another" on the exile-from-graveyard
// chooser, and the return to hand as an activation from the graveyard.
import { describe, expect, it } from 'vitest';
import { parseActivatedAbilities } from './activatedParse';
import { parseManaCost } from './oracleParse';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

describe('D334 - the graveyard seam, continued', () => {
  it('reads "another" and "other" on the exile-from-graveyard chooser', () => {
    const [a] = parse('{1}, Exile another creature card from your graveyard: Return this card from your graveyard to the battlefield.');
    expect(a?.exileFromGraveyardCost).toEqual({ count: 1, any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }], another: true });
    expect(a?.activatesFromGraveyard).toBe(true);
    expect(a?.payable).toBe(true);
    const [b] = parse('{B}, Exile two other creature cards from your graveyard: Return this card from your graveyard to the battlefield.');
    expect(b?.exileFromGraveyardCost).toEqual({ count: 2, any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }], another: true });
    const [c] = parse('{R}, {T}, Exile two cards from your graveyard: This creature deals 2 damage to any target.');
    expect(c?.exileFromGraveyardCost).toEqual({ count: 2, any: null, another: false });
  });

  it('reads the return to hand as an activation from the graveyard', () => {
    const [a] = parse('{1}{B}: Return this card from your graveyard to your hand.');
    expect(a?.activatesFromGraveyard).toBe(true);
    expect(a?.payable).toBe(true);
    const [b] = parse('{1}{B}: Return target creature card from your graveyard to your hand.');
    expect(b?.activatesFromGraveyard).toBe(false);
  });
});
