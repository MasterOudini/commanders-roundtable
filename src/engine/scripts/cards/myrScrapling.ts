// `Myr Scrapling` — "Sacrifice this creature: Put a +1/+1 counter on target
// creature." The self-sacrifice cost through D169's staged chain, paying
// for a counter. D227.

import { MYR_SCRAPLING } from '../../../data/fixtures/engineCards';
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
  MYR_SCRAPLING,
  'Sacrifice this creature: Put a +1/+1 counter on target creature.',
);

export const MYR_SCRAPLING_SCRIPT: CardScript = {
  oracleId: MYR_SCRAPLING.oracleId,
  name: MYR_SCRAPLING.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${MYR_SCRAPLING.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
