// `Charging Slateback` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHARGING_SLATEBACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHARGING_SLATEBACK, "This creature can't block.\nMorph {4}{R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

export const CHARGING_SLATEBACK_SCRIPT: CardScript = {
  oracleId: CHARGING_SLATEBACK.oracleId,
  name: CHARGING_SLATEBACK.name,
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
