// `Deranged Outcast` — "{1}{G}, Sacrifice a Human: Put two +1/+1 counters on
// target creature." Arms Dealer's staged chain (D168 chooser + D169 target)
// with a Human predicate, paying into the counter `derive` sums at layer 7d.
// M6.4o, D171.

import { DERANGED_OUTCAST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  DERANGED_OUTCAST,
  '{1}{G}, Sacrifice a Human: Put two +1/+1 counters on target creature.',
);

export const DERANGED_OUTCAST_SCRIPT: CardScript = {
  oracleId: DERANGED_OUTCAST.oracleId,
  name: DERANGED_OUTCAST.name,
  activated: [
    {
      ref: `${DERANGED_OUTCAST.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 2 }] }];
      },
    },
  ],
};
