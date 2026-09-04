// `Syphon Sliver` - a layer-6 grant: "Sliver creatures you control have lifelink. (Damage dealt by a Sliver creature you control also causes you to gain that much life.)". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { SYPHON_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SYPHON_SLIVER, "Sliver creatures you control have lifelink. (Damage dealt by a Sliver creature you control also causes you to gain that much life.)");
const TEXT = PRINTED;

export const SYPHON_SLIVER_SCRIPT: CardScript = {
  oracleId: SYPHON_SLIVER.oracleId,
  name: SYPHON_SLIVER.name,
  statics: [
    {
      abilityId: 'grant',
      text: TEXT,
      layer: 'ability',
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
        chars.keywords.add("lifelink");
      },
    },
  ],
};
