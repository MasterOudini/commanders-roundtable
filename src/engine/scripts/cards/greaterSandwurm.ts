// `Greater Sandwurm` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GREATER_SANDWURM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GREATER_SANDWURM, "This creature can't be blocked by creatures with power 2 or less.\nCycling {2} ({2}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

export const GREATER_SANDWURM_SCRIPT: CardScript = {
  oracleId: GREATER_SANDWURM.oracleId,
  name: GREATER_SANDWURM.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
