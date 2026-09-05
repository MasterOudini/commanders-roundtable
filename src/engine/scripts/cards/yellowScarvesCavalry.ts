// `Yellow Scarves Cavalry` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YELLOW_SCARVES_CAVALRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YELLOW_SCARVES_CAVALRY, "Horsemanship (This creature can't be blocked except by creatures with horsemanship.)\nThis creature can't block.");
const LINES = PRINTED.split('\n');

export const YELLOW_SCARVES_CAVALRY_SCRIPT: CardScript = {
  oracleId: YELLOW_SCARVES_CAVALRY.oracleId,
  name: YELLOW_SCARVES_CAVALRY.name,
  combat: [
    {
      abilityId: 'cantBlock-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
