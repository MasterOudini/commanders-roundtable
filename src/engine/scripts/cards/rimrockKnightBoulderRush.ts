// `Rimrock Knight // Boulder Rush` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIMROCK_KNIGHT_BOULDER_RUSH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(RIMROCK_KNIGHT_BOULDER_RUSH, "This creature can't block.\nTarget creature gets +2/+0 until end of turn. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const RIMROCK_KNIGHT_BOULDER_RUSH_SCRIPT: CardScript = {
  oracleId: RIMROCK_KNIGHT_BOULDER_RUSH.oracleId,
  name: RIMROCK_KNIGHT_BOULDER_RUSH.name,
  combat: [
    {
      abilityId: 'cantBlock-0', face: 0,
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
