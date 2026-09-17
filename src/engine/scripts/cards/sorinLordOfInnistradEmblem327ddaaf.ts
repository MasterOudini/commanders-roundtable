// `Sorin, Lord of Innistrad Emblem` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SORIN_LORD_OF_INNISTRAD_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SORIN_LORD_OF_INNISTRAD_EMBLEM, "Creatures you control get +1/+0.");

export const SORIN_LORD_OF_INNISTRAD_EMBLEM327DDAAF_SCRIPT: CardScript = {
  oracleId: SORIN_LORD_OF_INNISTRAD_EMBLEM.oracleId,
  name: SORIN_LORD_OF_INNISTRAD_EMBLEM.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
