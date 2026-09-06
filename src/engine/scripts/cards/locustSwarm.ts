// `Locust Swarm` - an activation regenerate, an activation untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOCUST_SWARM } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(LOCUST_SWARM, "Flying\n{G}: Regenerate this creature.\n{G}: Untap this creature. Activate only once each turn.");
const LINES = PRINTED.split('\n');

export const LOCUST_SWARM_SCRIPT: CardScript = {
  oracleId: LOCUST_SWARM.oracleId,
  name: LOCUST_SWARM.name,
  activated: [
    {
      ref: `${LOCUST_SWARM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
    {
      ref: `${LOCUST_SWARM.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
