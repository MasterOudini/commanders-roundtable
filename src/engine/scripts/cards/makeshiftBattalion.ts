// `Makeshift Battalion` - a battalion trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAKESHIFT_BATTALION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAKESHIFT_BATTALION, "Battalion — Whenever this creature and at least two other creatures attack, put a +1/+1 counter on this creature.");

export const MAKESHIFT_BATTALION_SCRIPT: CardScript = {
  oracleId: MAKESHIFT_BATTALION.oracleId,
  name: MAKESHIFT_BATTALION.name,
  triggers: [
    {
      abilityId: 'battalion-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ev.attackers.length >= 3,
      label: () => "Makeshift Battalion - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
