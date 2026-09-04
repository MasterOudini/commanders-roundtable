// `Maze Abomination` - a layer-6 grant: "Multicolored creatures you control have deathtouch". A StaticDef in the shape of the
// engine's Levitation (D129/D300): `appliesTo` reads the candidate's built characteristics,
// never derives it. Generated from one table row.

import { MAZE_ABOMINATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAZE_ABOMINATION, "Deathtouch (Any amount of damage this deals to a creature is enough to destroy it.)\nMulticolored creatures you control have deathtouch.");
const TEXT = PRINTED.split('\n')[1] as string;

export const MAZE_ABOMINATION_SCRIPT: CardScript = {
  oracleId: MAZE_ABOMINATION.oracleId,
  name: MAZE_ABOMINATION.name,
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
        if (chars.colors.length < 2) return false;
        return true;
      },
      modify: (chars) => {
        chars.keywords.add("deathtouch");
      },
    },
  ],
};
