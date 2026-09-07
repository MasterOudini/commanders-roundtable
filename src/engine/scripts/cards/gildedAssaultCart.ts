// `Gilded Assault Cart` - an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GILDED_ASSAULT_CART } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GILDED_ASSAULT_CART, "Trample\nCrew 2 (Tap any number of creatures you control with total power 2 or more: This Vehicle becomes an artifact creature until end of turn.)\nSacrifice two Treasures: Return this card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

export const GILDED_ASSAULT_CART_SCRIPT: CardScript = {
  oracleId: GILDED_ASSAULT_CART.oracleId,
  name: GILDED_ASSAULT_CART.name,
  activated: [
    {
      ref: `${GILDED_ASSAULT_CART.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
