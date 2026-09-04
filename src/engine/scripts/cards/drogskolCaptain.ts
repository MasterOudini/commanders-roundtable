// `Drogskol Captain` - a layer-6 anthem: "Other Spirit creatures you control get +1/+1 and have hexproof. (They can't be the targets of spells or abilities your opponents control.)". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { DROGSKOL_CAPTAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DROGSKOL_CAPTAIN, "Flying\nOther Spirit creatures you control get +1/+1 and have hexproof. (They can't be the targets of spells or abilities your opponents control.)");
const TEXT = PRINTED.split('\n')[1] as string;

export const DROGSKOL_CAPTAIN_SCRIPT: CardScript = {
  oracleId: DROGSKOL_CAPTAIN.oracleId,
  name: DROGSKOL_CAPTAIN.name,
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
        if (!chars.typeLine.subtypes.includes("Spirit")) return false;
        return true;
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
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
        if (!chars.typeLine.subtypes.includes("Spirit")) return false;
        return true;
      },
      modify: (chars) => {
        chars.keywords.add("hexproof");
      },
    },
  ],
};
