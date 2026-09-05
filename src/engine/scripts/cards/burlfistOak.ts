// `Burlfist Oak` - a drawsCard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURLFIST_OAK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BURLFIST_OAK, "Whenever you draw a card, this creature gets +2/+2 until end of turn.");

export const BURLFIST_OAK_SCRIPT: CardScript = {
  oracleId: BURLFIST_OAK.oracleId,
  name: BURLFIST_OAK.name,
  triggers: [
    {
      abilityId: 'drawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Burlfist Oak - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
