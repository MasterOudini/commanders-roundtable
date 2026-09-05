// `Hoverguard Observer` - a static blocksOnlyFlying
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOVERGUARD_OBSERVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOVERGUARD_OBSERVER, "Flying\nThis creature can block only creatures with flying.");
const LINES = PRINTED.split('\n');

export const HOVERGUARD_OBSERVER_SCRIPT: CardScript = {
  oracleId: HOVERGUARD_OBSERVER.oracleId,
  name: HOVERGUARD_OBSERVER.name,
  combat: [
    {
      abilityId: 'blocksOnlyFlying-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== self || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
