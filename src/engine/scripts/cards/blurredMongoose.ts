// `Blurred Mongoose` - a static cantBeCountered
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLURRED_MONGOOSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLURRED_MONGOOSE, "This spell can't be countered.\nShroud (This creature can't be the target of spells or abilities.)");
const LINES = PRINTED.split('\n');

export const BLURRED_MONGOOSE_SCRIPT: CardScript = {
  oracleId: BLURRED_MONGOOSE.oracleId,
  name: BLURRED_MONGOOSE.name,
  cantBeCountered: { abilityId: 'cant-be-countered-0', text: LINES[0] as string },
};
