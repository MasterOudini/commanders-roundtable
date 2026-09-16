// `Rampart Crawler` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAMPART_CRAWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAMPART_CRAWLER, "This creature can't be blocked by Walls.");

export const RAMPART_CRAWLER_SCRIPT: CardScript = {
  oracleId: RAMPART_CRAWLER.oracleId,
  name: RAMPART_CRAWLER.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).typeLine.subtypes.includes('Wall')),
    },
  ],
};
