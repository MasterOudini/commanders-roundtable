// `Korlessa, Scale Singer` - a static topOfLibrary, a static topOfLibrary
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KORLESSA_SCALE_SINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KORLESSA_SCALE_SINGER, "You may look at the top card of your library any time.\nYou may cast Dragon spells from the top of your library.");
const LINES = PRINTED.split('\n');

export const KORLESSA_SCALE_SINGER_SCRIPT: CardScript = {
  oracleId: KORLESSA_SCALE_SINGER.oracleId,
  name: KORLESSA_SCALE_SINGER.name,
  topOfLibrary: [
    { abilityId: "top-0", text: LINES[0] as string, look: true },
    { abilityId: "top-1", text: LINES[1] as string, spells: {"predicates":[{"supertypes":[],"types":[],"subtypes":["Dragon"],"colors":[]}]} },
  ],
};
