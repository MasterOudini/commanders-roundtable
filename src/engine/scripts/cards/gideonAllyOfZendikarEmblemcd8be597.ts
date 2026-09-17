// `Gideon, Ally of Zendikar Emblem` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIDEON_ALLY_OF_ZENDIKAR_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GIDEON_ALLY_OF_ZENDIKAR_EMBLEM, "Creatures you control get +1/+1.");

export const GIDEON_ALLY_OF_ZENDIKAR_EMBLEMCD8BE597_SCRIPT: CardScript = {
  oracleId: GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.oracleId,
  name: GIDEON_ALLY_OF_ZENDIKAR_EMBLEM.name,
  statics: [
    {
      abilityId: 'anthem-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
