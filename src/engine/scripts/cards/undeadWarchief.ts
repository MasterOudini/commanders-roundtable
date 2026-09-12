// `Undead Warchief` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDEAD_WARCHIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNDEAD_WARCHIEF, "Zombie spells you cast cost {1} less to cast.\nZombie creatures you control get +2/+1.");
const LINES = PRINTED.split('\n');

export const UNDEAD_WARCHIEF_SCRIPT: CardScript = {
  oracleId: UNDEAD_WARCHIEF.oracleId,
  name: UNDEAD_WARCHIEF.name,
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Zombie") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
