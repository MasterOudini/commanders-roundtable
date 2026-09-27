// `Underworld Charger` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDERWORLD_CHARGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNDERWORLD_CHARGER, "This creature can't block.\nEscape—{4}{B}, Exile three other cards from your graveyard. (You may cast this card from your graveyard for its escape cost.)\nThis creature escapes with two +1/+1 counters on it.");
const LINES = PRINTED.split('\n');

export const UNDERWORLD_CHARGER_SCRIPT: CardScript = {
  oracleId: UNDERWORLD_CHARGER.oracleId,
  name: UNDERWORLD_CHARGER.name,
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
