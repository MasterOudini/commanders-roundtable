// `Blighted Agent` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIGHTED_AGENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIGHTED_AGENT, "Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\nThis creature can't be blocked.");
const LINES = PRINTED.split('\n');

export const BLIGHTED_AGENT_SCRIPT: CardScript = {
  oracleId: BLIGHTED_AGENT.oracleId,
  name: BLIGHTED_AGENT.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
