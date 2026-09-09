// `Corrosive Mentor` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORROSIVE_MENTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORROSIVE_MENTOR, "Black creatures you control have wither. (They deal damage to creatures in the form of -1/-1 counters.)");

export const CORROSIVE_MENTOR_SCRIPT: CardScript = {
  oracleId: CORROSIVE_MENTOR.oracleId,
  name: CORROSIVE_MENTOR.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.colors.includes("B") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("wither");
      },
    },
  ],
};
