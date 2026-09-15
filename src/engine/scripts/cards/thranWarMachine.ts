// `Thran War Machine` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRAN_WAR_MACHINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THRAN_WAR_MACHINE, "Echo {4} (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const THRAN_WAR_MACHINE_SCRIPT: CardScript = {
  oracleId: THRAN_WAR_MACHINE.oracleId,
  name: THRAN_WAR_MACHINE.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
