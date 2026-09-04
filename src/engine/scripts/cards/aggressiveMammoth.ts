// `Aggressive Mammoth` - a layer-6 grant: "Other creatures you control have trample". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { AGGRESSIVE_MAMMOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AGGRESSIVE_MAMMOTH, "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\nOther creatures you control have trample.");
const TEXT = PRINTED.split('\n')[1] as string;

export const AGGRESSIVE_MAMMOTH_SCRIPT: CardScript = {
  oracleId: AGGRESSIVE_MAMMOTH.oracleId,
  name: AGGRESSIVE_MAMMOTH.name,
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
        if (candidate === self) return false;
        if (!chars.typeLine.types.includes("Creature")) return false;
        return true;
      },
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
