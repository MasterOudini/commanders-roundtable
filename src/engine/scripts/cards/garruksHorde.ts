// `Garruk's Horde` - a static topOfLibrary, a static topOfLibrary
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GARRUK_S_HORDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GARRUK_S_HORDE, "Trample\nPlay with the top card of your library revealed.\nYou may cast creature spells from the top of your library. (Do this only any time you could cast that creature spell. You still pay the spell's costs.)");
const LINES = PRINTED.split('\n');

export const GARRUKS_HORDE_SCRIPT: CardScript = {
  oracleId: GARRUK_S_HORDE.oracleId,
  name: GARRUK_S_HORDE.name,
  topOfLibrary: [
    { abilityId: "top-1", text: LINES[1] as string, revealed: true },
    { abilityId: "top-2", text: LINES[2] as string, spells: {"predicates":[{"supertypes":[],"types":["Creature"],"subtypes":[],"colors":[]}]} },
  ],
};
