// `Great Sable Stag` - a static cantBeCountered
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GREAT_SABLE_STAG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GREAT_SABLE_STAG, "This spell can't be countered.\nProtection from blue and from black (This creature can't be blocked, targeted, dealt damage, or enchanted by anything blue or black.)");
const LINES = PRINTED.split('\n');

export const GREAT_SABLE_STAG_SCRIPT: CardScript = {
  oracleId: GREAT_SABLE_STAG.oracleId,
  name: GREAT_SABLE_STAG.name,
  cantBeCountered: { abilityId: 'cant-be-countered-0', text: LINES[0] as string },
};
