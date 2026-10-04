// `Dread Linnorm // Scale Deflection` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAD_LINNORM_SCALE_DEFLECTION } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(DREAD_LINNORM_SCALE_DEFLECTION, "This creature can't be blocked by creatures with power 3 or less.\nPut two +1/+1 counters on target creature and untap it. It gains hexproof until end of turn. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const DREAD_LINNORM_SCALE_DEFLECTION_SCRIPT: CardScript = {
  oracleId: DREAD_LINNORM_SCALE_DEFLECTION.oracleId,
  name: DREAD_LINNORM_SCALE_DEFLECTION.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0', face: 0,
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 3,
    },
  ],
};
