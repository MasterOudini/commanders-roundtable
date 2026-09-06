// D329 - the graveyard costs: "Exile this card from your graveyard" (CR 113.6,
// activated from the graveyard) and "Exile N <predicate> cards from your
// graveyard" (a chooser over the graveyard, the discard chooser's shape).
import { describe, expect, it } from 'vitest';
import { parseActivatedAbilities } from './activatedParse';
import { parseManaCost } from './oracleParse';

const parse = (text: string, selfName?: string) =>
  parseActivatedAbilities({
    oracleText: text,
    isPermanent: true,
    producesMana: [],
    parseCost: (raw) => parseManaCost(raw),
    ...(selfName ? { selfName } : {}),
  });

describe('D329 - the graveyard costs', () => {
  it('reads "Exile this card from your graveyard" as an activation from the graveyard', () => {
    const [a] = parse('{W}, Exile this card from your graveyard: Create a 1/1 green and white Kithkin creature token. Activate only as a sorcery.');
    expect(a?.exileSelfFromGraveyard).toBe(true);
    expect(a?.exileFromGraveyardCost).toBeNull();
    expect(a?.payable).toBe(true);
    expect(a?.sorceryOnly).toBe(true);
    // An older printing names the card.
    const [b] = parse('{2}{G}, Exile Bramble Wurm from your graveyard: You gain 5 life.', 'Bramble Wurm');
    expect(b?.exileSelfFromGraveyard).toBe(true);
    expect(b?.payable).toBe(true);
    // A battlefield ability stays what it was.
    const [c] = parse('{3}{G}{G}: Create a 3/3 green Beast creature token.');
    expect(c?.exileSelfFromGraveyard).toBe(false);
  });

  it('reads "Exile N cards from your graveyard" as a chooser with a count and no predicate', () => {
    const [a] = parse('{R}, {T}, Exile two cards from your graveyard: This creature deals 2 damage to any target.');
    expect(a?.exileFromGraveyardCost).toEqual({ count: 2, any: null, another: false });
    expect(a?.exileSelfFromGraveyard).toBe(false);
    expect(a?.payable).toBe(true);
    const [b] = parse('{4}, Exile a card from your graveyard: Target creature gains flying until end of turn.');
    expect(b?.exileFromGraveyardCost).toEqual({ count: 1, any: null, another: false });
  });

  it('reads a typed chooser through the predicate reader, "or" split', () => {
    const [a] = parse('{1}, {T}, Exile a creature card from your graveyard: Create a Treasure token.');
    expect(a?.exileFromGraveyardCost).toEqual({ count: 1, any: [{ supertypes: [], types: ['Creature'], subtypes: [], colors: [] }], another: false });
    const [b] = parse('{2}{B}, Exile an Elf card from your graveyard: This creature gets +3/+3 until end of turn.');
    expect(b?.exileFromGraveyardCost?.any).toEqual([{ supertypes: [], types: [], subtypes: ['Elf'], colors: [] }]);
    const [c] = parse('{T}, Exile an instant or sorcery card from your graveyard: Put a +1/+1 counter on this creature.');
    expect(c?.exileFromGraveyardCost?.any?.map((p) => p.types[0])).toEqual(['Instant', 'Sorcery']);
    // A wording the reader cannot place stays unpaid.
    const [d] = parse('{B}, Exile two creature cards from a single graveyard: Draw a card.');
    expect(d?.exileFromGraveyardCost).toBeNull();
    expect(d?.payable).toBe(false);
  });
});
