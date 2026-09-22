// `Joiner Adept` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JOINER_ADEPT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedMana, pushGrantedMana } from '../grants';
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

const PRINTED = printed(JOINER_ADEPT, "Lands you control have \"{T}: Add one mana of any color.\"");

const GRANT_0 = grantedMana("{T}: Add one mana of any color.", JOINER_ADEPT.name);

export const JOINER_ADEPT_SCRIPT: CardScript = {
  oracleId: JOINER_ADEPT.oracleId,
  name: JOINER_ADEPT.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        pushGrantedMana(chars, GRANT_0);
      },
    },
  ],
};
