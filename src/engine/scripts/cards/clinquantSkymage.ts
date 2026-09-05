// `Clinquant Skymage` - a drawsCard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLINQUANT_SKYMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLINQUANT_SKYMAGE, "Flying\nWhenever you draw a card, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const CLINQUANT_SKYMAGE_SCRIPT: CardScript = {
  oracleId: CLINQUANT_SKYMAGE.oracleId,
  name: CLINQUANT_SKYMAGE.name,
  triggers: [
    {
      abilityId: 'drawsCard-1',
      text: LINES[1] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Clinquant Skymage - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
