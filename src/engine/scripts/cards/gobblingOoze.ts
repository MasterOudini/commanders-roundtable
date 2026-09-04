// `Gobbling Ooze` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBBLING_OOZE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBBLING_OOZE, "{G}, Sacrifice another creature: Put a +1/+1 counter on this creature.");

export const GOBBLING_OOZE_SCRIPT: CardScript = {
  oracleId: GOBBLING_OOZE.oracleId,
  name: GOBBLING_OOZE.name,
  activated: [
    {
      ref: `${GOBBLING_OOZE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
