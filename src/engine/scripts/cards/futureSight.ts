// `Future Sight` - a static topOfLibrary, a static topOfLibrary
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FUTURE_SIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FUTURE_SIGHT, "Play with the top card of your library revealed.\nYou may play lands and cast spells from the top of your library.");
const LINES = PRINTED.split('\n');

export const FUTURE_SIGHT_SCRIPT: CardScript = {
  oracleId: FUTURE_SIGHT.oracleId,
  name: FUTURE_SIGHT.name,
  topOfLibrary: [
    { abilityId: "top-0", text: LINES[0] as string, revealed: true },
    { abilityId: "top-1", text: LINES[1] as string, lands: true, spells: "any" },
  ],
};
