// `Aysen Highway` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AYSEN_HIGHWAY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AYSEN_HIGHWAY, "White creatures have plainswalk. (They can't be blocked as long as defending player controls a Plains.)");

export const AYSEN_HIGHWAY_SCRIPT: CardScript = {
  oracleId: AYSEN_HIGHWAY.oracleId,
  name: AYSEN_HIGHWAY.name,
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.colors.includes("W"),
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Plains"];
      },
    },
  ],
};
