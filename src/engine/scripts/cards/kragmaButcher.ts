// `Kragma Butcher` - a becomesUntapped trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KRAGMA_BUTCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KRAGMA_BUTCHER, "Inspired — Whenever this creature becomes untapped, it gets +2/+0 until end of turn.");

export const KRAGMA_BUTCHER_SCRIPT: CardScript = {
  oracleId: KRAGMA_BUTCHER.oracleId,
  name: KRAGMA_BUTCHER.name,
  triggers: [
    {
      abilityId: 'becomesUntapped-0',
      text: PRINTED,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsUntapped' && ev.cards.includes(self),
      label: () => "Kragma Butcher - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
