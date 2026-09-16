// `Juggernaut` - a static mustAttack, a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JUGGERNAUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JUGGERNAUT, "This creature attacks each combat if able.\nThis creature can't be blocked by Walls.");
const LINES = PRINTED.split('\n');

export const JUGGERNAUT_SCRIPT: CardScript = {
  oracleId: JUGGERNAUT.oracleId,
  name: JUGGERNAUT.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
    {
      abilityId: 'cantBeBlockedBy-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).typeLine.subtypes.includes('Wall')),
    },
  ],
};
