// `Spike-Tailed Ceratops` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIKE_TAILED_CERATOPS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIKE_TAILED_CERATOPS, "This creature can block an additional creature each combat.");

export const SPIKE_TAILED_CERATOPS_SCRIPT: CardScript = {
  oracleId: SPIKE_TAILED_CERATOPS.oracleId,
  name: SPIKE_TAILED_CERATOPS.name,
  combat: [
    {
      abilityId: 'blockCapacity-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
