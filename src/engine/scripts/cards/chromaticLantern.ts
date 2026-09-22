// `Chromatic Lantern` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHROMATIC_LANTERN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHROMATIC_LANTERN, "Lands you control have \"{T}: Add one mana of any color.\"\n{T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

const GRANT_0 = grantedMana("{T}: Add one mana of any color.", CHROMATIC_LANTERN.name);

export const CHROMATIC_LANTERN_SCRIPT: CardScript = {
  oracleId: CHROMATIC_LANTERN.oracleId,
  name: CHROMATIC_LANTERN.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        pushGrantedMana(chars, GRANT_0);
      },
    },
  ],
};
