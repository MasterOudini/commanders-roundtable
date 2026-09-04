// `Anaba Spirit Crafter` - a layer-6 anthem: "Minotaur creatures get +1/+0". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { ANABA_SPIRIT_CRAFTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANABA_SPIRIT_CRAFTER, "Minotaur creatures get +1/+0.");
const TEXT = PRINTED;

export const ANABA_SPIRIT_CRAFTER_SCRIPT: CardScript = {
  oracleId: ANABA_SPIRIT_CRAFTER.oracleId,
  name: ANABA_SPIRIT_CRAFTER.name,
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
        if (!chars.typeLine.subtypes.includes("Minotaur")) return false;
        return true;
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
