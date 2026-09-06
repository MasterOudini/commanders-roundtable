// `Tyrranax Rex` - a static cantBeCountered
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TYRRANAX_REX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TYRRANAX_REX, "This spell can't be countered.\nTrample, ward {4}, haste\nToxic 4 (Players dealt combat damage by this creature also get four poison counters.)");
const LINES = PRINTED.split('\n');

export const TYRRANAX_REX_SCRIPT: CardScript = {
  oracleId: TYRRANAX_REX.oracleId,
  name: TYRRANAX_REX.name,
  cantBeCountered: { abilityId: 'cant-be-countered-0', text: LINES[0] as string },
};
