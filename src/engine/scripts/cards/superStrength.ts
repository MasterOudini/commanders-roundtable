// `Super Strength` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUPER_STRENGTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUPER_STRENGTH, "Enchant creature\nEnchanted creature gets +4/+4 and has trample and ward {1}. (Whenever enchanted creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {1}.)");
const LINES = PRINTED.split('\n');

export const SUPER_STRENGTH_SCRIPT: CardScript = {
  oracleId: SUPER_STRENGTH.oracleId,
  name: SUPER_STRENGTH.name,
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 4;
        if (chars.toughness !== null) chars.toughness += 4;
      },
    },
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("trample");
        chars.wards.push({ wardCost: { generic: 1, xCount: 0, colored: { W: 0, U: 0, B: 0, R: 0, G: 0 }, colorless: 0, snow: 0, hybrids: [], manaValue: 1, raw: '{1}' }, wardLife: 0 });
      },
    },
  ],
};
