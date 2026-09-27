// `Crystal Carapace` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRYSTAL_CARAPACE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(CRYSTAL_CARAPACE, "Enchant creature\nEnchanted creature gets +3/+3 and has ward {2}.\nCycling {2} ({2}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

export const CRYSTAL_CARAPACE_SCRIPT: CardScript = {
  oracleId: CRYSTAL_CARAPACE.oracleId,
  name: CRYSTAL_CARAPACE.name,
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.wards.push({ wardCost: { generic: 2, xCount: 0, colored: { W: 0, U: 0, B: 0, R: 0, G: 0 }, colorless: 0, snow: 0, hybrids: [], manaValue: 2, raw: '{2}' }, wardLife: 0 });
      },
    },
  ],
};
