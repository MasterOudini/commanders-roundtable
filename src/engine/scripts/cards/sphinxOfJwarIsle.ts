// `Sphinx of Jwar Isle` - a static topOfLibrary
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPHINX_OF_JWAR_ISLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPHINX_OF_JWAR_ISLE, "Flying\nShroud (This creature can't be the target of spells or abilities.)\nYou may look at the top card of your library any time.");
const LINES = PRINTED.split('\n');

export const SPHINX_OF_JWAR_ISLE_SCRIPT: CardScript = {
  oracleId: SPHINX_OF_JWAR_ISLE.oracleId,
  name: SPHINX_OF_JWAR_ISLE.name,
  topOfLibrary: [
    { abilityId: "top-2", text: LINES[2] as string, look: true },
  ],
};
