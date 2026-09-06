// `Monstrous Carabid` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MONSTROUS_CARABID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MONSTROUS_CARABID, "This creature attacks each combat if able.\nCycling {B/R} ({B/R}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

export const MONSTROUS_CARABID_SCRIPT: CardScript = {
  oracleId: MONSTROUS_CARABID.oracleId,
  name: MONSTROUS_CARABID.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
