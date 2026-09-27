// `Winged Boots` - a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WINGED_BOOTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WINGED_BOOTS, "Equipped creature has flying and ward {4}. (Whenever equipped creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {4}.)\nEquip {1}");
const LINES = PRINTED.split('\n');

export const WINGED_BOOTS_SCRIPT: CardScript = {
  oracleId: WINGED_BOOTS.oracleId,
  name: WINGED_BOOTS.name,
  statics: [
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
        chars.wards.push({ wardCost: { generic: 4, xCount: 0, colored: { W: 0, U: 0, B: 0, R: 0, G: 0 }, colorless: 0, snow: 0, hybrids: [], manaValue: 4, raw: '{4}' }, wardLife: 0 });
      },
    },
  ],
};
