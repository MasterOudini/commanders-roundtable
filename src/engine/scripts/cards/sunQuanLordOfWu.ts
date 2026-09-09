// `Sun Quan, Lord of Wu` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUN_QUAN_LORD_OF_WU } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUN_QUAN_LORD_OF_WU, "Creatures you control have horsemanship. (They can't be blocked except by creatures with horsemanship.)");

export const SUN_QUAN_LORD_OF_WU_SCRIPT: CardScript = {
  oracleId: SUN_QUAN_LORD_OF_WU.oracleId,
  name: SUN_QUAN_LORD_OF_WU.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("horsemanship");
      },
    },
  ],
};
