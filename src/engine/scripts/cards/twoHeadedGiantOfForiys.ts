// `Two-Headed Giant of Foriys` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TWO_HEADED_GIANT_OF_FORIYS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TWO_HEADED_GIANT_OF_FORIYS, "Trample\nThis creature can block an additional creature each combat.");
const LINES = PRINTED.split('\n');

export const TWO_HEADED_GIANT_OF_FORIYS_SCRIPT: CardScript = {
  oracleId: TWO_HEADED_GIANT_OF_FORIYS.oracleId,
  name: TWO_HEADED_GIANT_OF_FORIYS.name,
  combat: [
    {
      abilityId: 'blockCapacity-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
