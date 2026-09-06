// `Battle-Mad Ronin` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BATTLE_MAD_RONIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BATTLE_MAD_RONIN, "Bushido 2 (Whenever this creature blocks or becomes blocked, it gets +2/+2 until end of turn.)\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const BATTLE_MAD_RONIN_SCRIPT: CardScript = {
  oracleId: BATTLE_MAD_RONIN.oracleId,
  name: BATTLE_MAD_RONIN.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
