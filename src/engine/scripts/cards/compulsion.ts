// `Compulsion` — two mana and a discarded card of my choice (D286) buy a
// card; two mana and the enchantment itself buy one too.

import { COMPULSION } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  COMPULSION,
  '{1}{U}, Discard a card: Draw a card.\n{1}{U}, Sacrifice this enchantment: Draw a card.',
);
const DISCARD = PRINTED.split('\n')[0] as string;
const SACRIFICE = PRINTED.split('\n')[1] as string;

export const COMPULSION_SCRIPT: CardScript = {
  oracleId: COMPULSION.oracleId,
  name: COMPULSION.name,
  activated: [
    {
      ref: `${COMPULSION.oracleId}#a0`,
      text: DISCARD,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
    {
      ref: `${COMPULSION.oracleId}#a1`,
      text: SACRIFICE,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
