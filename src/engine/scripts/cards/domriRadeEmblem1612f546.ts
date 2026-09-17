// `Domri Rade Emblem` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOMRI_RADE_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOMRI_RADE_EMBLEM, "Creatures you control have double strike, trample, hexproof, and haste.");

export const DOMRI_RADE_EMBLEM1612F546_SCRIPT: CardScript = {
  oracleId: DOMRI_RADE_EMBLEM.oracleId,
  name: DOMRI_RADE_EMBLEM.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['command'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
        chars.keywords.add("trample");
        chars.keywords.add("hexproof");
        chars.keywords.add("haste");
      },
    },
  ],
};
