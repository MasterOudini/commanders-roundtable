// `Kobold Drill Sergeant` - a layer-6 anthem: "Other Kobold creatures you control get +0/+1 and have trample". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { KOBOLD_DRILL_SERGEANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOBOLD_DRILL_SERGEANT, "Other Kobold creatures you control get +0/+1 and have trample.");
const TEXT = PRINTED;

export const KOBOLD_DRILL_SERGEANT_SCRIPT: CardScript = {
  oracleId: KOBOLD_DRILL_SERGEANT.oracleId,
  name: KOBOLD_DRILL_SERGEANT.name,
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
        if (candidate === self) return false;
        if (!chars.typeLine.types.includes("Creature")) return false;
        if (!chars.typeLine.subtypes.includes("Kobold")) return false;
        return true;
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
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
        if (candidate === self) return false;
        if (!chars.typeLine.types.includes("Creature")) return false;
        if (!chars.typeLine.subtypes.includes("Kobold")) return false;
        return true;
      },
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
