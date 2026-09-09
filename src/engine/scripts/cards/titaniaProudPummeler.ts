// `Titania, Proud Pummeler` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TITANIA_PROUD_PUMMELER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TITANIA_PROUD_PUMMELER, "First strike\nMelee (Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.)\nOther creatures you control have melee.");
const LINES = PRINTED.split('\n');

export const TITANIA_PROUD_PUMMELER_SCRIPT: CardScript = {
  oracleId: TITANIA_PROUD_PUMMELER.oracleId,
  name: TITANIA_PROUD_PUMMELER.name,
  statics: [
    {
      abilityId: 'anthem-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("melee");
      },
    },
  ],
};
