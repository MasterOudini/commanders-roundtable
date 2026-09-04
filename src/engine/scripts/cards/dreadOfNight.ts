// `Dread of Night` - a layer-6 anthem: "White creatures get -1/-1". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { DREAD_OF_NIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAD_OF_NIGHT, "White creatures get -1/-1.");
const TEXT = PRINTED;

export const DREAD_OF_NIGHT_SCRIPT: CardScript = {
  oracleId: DREAD_OF_NIGHT.oracleId,
  name: DREAD_OF_NIGHT.name,
  statics: [
    {
      abilityId: 'anthem',
      text: TEXT,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (!chars.typeLine.types.includes("Creature")) return false;
        if (!chars.colors.includes("W")) return false;
        return true;
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += -1;
        if (chars.toughness !== null) chars.toughness += -1;
      },
    },
  ],
};
