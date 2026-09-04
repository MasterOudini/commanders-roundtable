// `Megantic Sliver` - a layer-6 anthem: "Sliver creatures you control get +3/+3". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { MEGANTIC_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MEGANTIC_SLIVER, "Sliver creatures you control get +3/+3.");
const TEXT = PRINTED;

export const MEGANTIC_SLIVER_SCRIPT: CardScript = {
  oracleId: MEGANTIC_SLIVER.oracleId,
  name: MEGANTIC_SLIVER.name,
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
        if (target.controller !== source.controller) return false;
        if (!chars.typeLine.types.includes("Creature")) return false;
        if (!chars.typeLine.subtypes.includes("Sliver")) return false;
        return true;
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
  ],
};
