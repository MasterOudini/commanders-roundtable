// `Veteran of the Depths` - a becomesTapped trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VETERAN_OF_THE_DEPTHS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VETERAN_OF_THE_DEPTHS, "Whenever this creature becomes tapped, you may put a +1/+1 counter on it.");

export const VETERAN_OF_THE_DEPTHS_SCRIPT: CardScript = {
  oracleId: VETERAN_OF_THE_DEPTHS.oracleId,
  name: VETERAN_OF_THE_DEPTHS.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Veteran of the Depths - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
