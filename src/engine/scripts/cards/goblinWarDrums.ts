// `Goblin War Drums` - a layer-6 grant: "Creatures you control have menace. (They can't be blocked except by two or more creatures.)". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { GOBLIN_WAR_DRUMS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_WAR_DRUMS, "Creatures you control have menace. (They can't be blocked except by two or more creatures.)");
const TEXT = PRINTED;

export const GOBLIN_WAR_DRUMS_SCRIPT: CardScript = {
  oracleId: GOBLIN_WAR_DRUMS.oracleId,
  name: GOBLIN_WAR_DRUMS.name,
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
        return true;
      },
      modify: (chars) => {
        chars.keywords.add("menace");
      },
    },
  ],
};
