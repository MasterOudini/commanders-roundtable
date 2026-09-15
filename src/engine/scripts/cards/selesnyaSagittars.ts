// `Selesnya Sagittars` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SELESNYA_SAGITTARS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SELESNYA_SAGITTARS, "Reach (This creature can block creatures with flying.)\nThis creature can block an additional creature each combat.");
const LINES = PRINTED.split('\n');

export const SELESNYA_SAGITTARS_SCRIPT: CardScript = {
  oracleId: SELESNYA_SAGITTARS.oracleId,
  name: SELESNYA_SAGITTARS.name,
  combat: [
    {
      abilityId: 'blockCapacity-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
