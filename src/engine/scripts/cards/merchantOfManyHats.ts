// `Merchant of Many Hats` - an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERCHANT_OF_MANY_HATS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MERCHANT_OF_MANY_HATS, "{2}{B}: Return this card from your graveyard to your hand.");

export const MERCHANT_OF_MANY_HATS_SCRIPT: CardScript = {
  oracleId: MERCHANT_OF_MANY_HATS.oracleId,
  name: MERCHANT_OF_MANY_HATS.name,
  activated: [
    {
      ref: `${MERCHANT_OF_MANY_HATS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
