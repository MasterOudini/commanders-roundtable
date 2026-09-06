// `Phyrexian Juggernaut` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHYREXIAN_JUGGERNAUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHYREXIAN_JUGGERNAUT, "Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\nThis creature attacks each combat if able.");
const LINES = PRINTED.split('\n');

export const PHYREXIAN_JUGGERNAUT_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_JUGGERNAUT.oracleId,
  name: PHYREXIAN_JUGGERNAUT.name,
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
