// `Sightless Ghoul` - a static cantBlock
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIGHTLESS_GHOUL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIGHTLESS_GHOUL, "This creature can't block.\nUndying (When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter on it.)");
const LINES = PRINTED.split('\n');

export const SIGHTLESS_GHOUL_SCRIPT: CardScript = {
  oracleId: SIGHTLESS_GHOUL.oracleId,
  name: SIGHTLESS_GHOUL.name,
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
