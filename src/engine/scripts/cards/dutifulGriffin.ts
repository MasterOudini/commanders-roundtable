// `Dutiful Griffin` - an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUTIFUL_GRIFFIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUTIFUL_GRIFFIN, "Flying\n{2}{W}, Sacrifice two enchantments: Return this card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

export const DUTIFUL_GRIFFIN_SCRIPT: CardScript = {
  oracleId: DUTIFUL_GRIFFIN.oracleId,
  name: DUTIFUL_GRIFFIN.name,
  activated: [
    {
      ref: `${DUTIFUL_GRIFFIN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
