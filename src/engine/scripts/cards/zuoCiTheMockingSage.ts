// `Zuo Ci, the Mocking Sage` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZUO_CI_THE_MOCKING_SAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZUO_CI_THE_MOCKING_SAGE, "Hexproof (This creature can't be the target of spells or abilities your opponents control.)\nZuo Ci can't be blocked by creatures with horsemanship.");
const LINES = PRINTED.split('\n');

export const ZUO_CI_THE_MOCKING_SAGE_SCRIPT: CardScript = {
  oracleId: ZUO_CI_THE_MOCKING_SAGE.oracleId,
  name: ZUO_CI_THE_MOCKING_SAGE.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).keywords.has('horsemanship')),
    },
  ],
};
