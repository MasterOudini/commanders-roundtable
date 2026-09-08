// `Manticore Eternal` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MANTICORE_ETERNAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANTICORE_ETERNAL, "Afflict 3 (Whenever this creature becomes blocked, defending player loses 3 life.)\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const MANTICORE_ETERNAL_SCRIPT: CardScript = {
  oracleId: MANTICORE_ETERNAL.oracleId,
  name: MANTICORE_ETERNAL.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
