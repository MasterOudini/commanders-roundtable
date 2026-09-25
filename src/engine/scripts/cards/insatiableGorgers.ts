// `Insatiable Gorgers` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INSATIABLE_GORGERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INSATIABLE_GORGERS, "This creature attacks each combat if able.\nMadness {3}{R} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

export const INSATIABLE_GORGERS_SCRIPT: CardScript = {
  oracleId: INSATIABLE_GORGERS.oracleId,
  name: INSATIABLE_GORGERS.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
