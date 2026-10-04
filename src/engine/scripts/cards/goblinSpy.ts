// `Goblin Spy` - a static topOfLibrary
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_SPY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_SPY, "Play with the top card of your library revealed.");

export const GOBLIN_SPY_SCRIPT: CardScript = {
  oracleId: GOBLIN_SPY.oracleId,
  name: GOBLIN_SPY.name,
  topOfLibrary: [
    { abilityId: "top-0", text: PRINTED, revealed: true },
  ],
};
