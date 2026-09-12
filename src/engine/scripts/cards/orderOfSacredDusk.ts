// `Order of Sacred Dusk` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORDER_OF_SACRED_DUSK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORDER_OF_SACRED_DUSK, "Convoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature's color.)\nFlying, lifelink, haste\nExalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\nOther Vampires you control have exalted.");
const LINES = PRINTED.split('\n');

export const ORDER_OF_SACRED_DUSK_SCRIPT: CardScript = {
  oracleId: ORDER_OF_SACRED_DUSK.oracleId,
  name: ORDER_OF_SACRED_DUSK.name,
  statics: [
    {
      abilityId: 'anthem-grant-3',
      text: LINES[3] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Vampire") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("exalted");
      },
    },
  ],
};
