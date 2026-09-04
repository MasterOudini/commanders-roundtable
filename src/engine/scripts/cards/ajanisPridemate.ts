// `Ajani's Pridemate` - a youGainLife trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AJANI_S_PRIDEMATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AJANI_S_PRIDEMATE, "Whenever you gain life, put a +1/+1 counter on this creature.");

export const AJANIS_PRIDEMATE_SCRIPT: CardScript = {
  oracleId: AJANI_S_PRIDEMATE.oracleId,
  name: AJANI_S_PRIDEMATE.name,
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: PRINTED,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Ajani's Pridemate - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
