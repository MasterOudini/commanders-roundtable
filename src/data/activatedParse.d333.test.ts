// D333 - "Return this card from your graveyard to the battlefield": the effect
// names the zone the ability is activated from (CR 113.6), so the ability is
// offered from the graveyard though its cost exiles nothing.
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

describe('D333 - the graveyard returns', () => {
  it('reads the return as an activation from the graveyard', () => {
    const [a] = parse('{3}{B}: Return this card from your graveyard to the battlefield tapped. Activate only as a sorcery.');
    expect(a?.activatesFromGraveyard).toBe(true);
    expect(a?.exileSelfFromGraveyard).toBe(false);
    expect(a?.payable).toBe(true);
    expect(a?.sorceryOnly).toBe(true);
    const [b] = parse('{2}{G}{G}: Return Nether Traitor from your graveyard to the battlefield.', 'Nether Traitor');
    expect(b?.activatesFromGraveyard).toBe(true);
  });

  it('leaves every other ability where it was', () => {
    const [a] = parse('{2}{G}, Exile this card from your graveyard: Create a 3/3 green Beast creature token.');
    expect(a?.activatesFromGraveyard).toBe(false);
    expect(a?.exileSelfFromGraveyard).toBe(true);
    const [b] = parse('{1}{B}: Return target creature card from your graveyard to your hand.');
    expect(b?.activatesFromGraveyard).toBe(false);
  });
});
