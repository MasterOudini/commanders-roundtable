// `Zarda, the Power Princess` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZARDA_THE_POWER_PRINCESS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZARDA_THE_POWER_PRINCESS, "Flying\nOther Heroes you control have exalted. (Whenever a creature you control attacks alone, it gets +1/+1 until end of turn for each instance of exalted among permanents you control.)");
const LINES = PRINTED.split('\n');

export const ZARDA_THE_POWER_PRINCESS_SCRIPT: CardScript = {
  oracleId: ZARDA_THE_POWER_PRINCESS.oracleId,
  name: ZARDA_THE_POWER_PRINCESS.name,
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Hero") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("exalted");
      },
    },
  ],
};
