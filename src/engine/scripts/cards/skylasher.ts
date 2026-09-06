// `Skylasher` - a static cantBeCountered
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYLASHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYLASHER, "Flash\nThis spell can't be countered.\nReach, protection from blue");
const LINES = PRINTED.split('\n');

export const SKYLASHER_SCRIPT: CardScript = {
  oracleId: SKYLASHER.oracleId,
  name: SKYLASHER.name,
  cantBeCountered: { abilityId: 'cant-be-countered-1', text: LINES[1] as string },
};
