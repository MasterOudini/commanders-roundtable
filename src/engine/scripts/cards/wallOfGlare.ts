// `Wall of Glare` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WALL_OF_GLARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WALL_OF_GLARE, "Defender (This creature can't attack.)\nThis creature can block any number of creatures.");
const LINES = PRINTED.split('\n');

export const WALL_OF_GLARE_SCRIPT: CardScript = {
  oracleId: WALL_OF_GLARE.oracleId,
  name: WALL_OF_GLARE.name,
  combat: [
    {
      abilityId: 'blockCapacity-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? Infinity : null),
    },
  ],
};
