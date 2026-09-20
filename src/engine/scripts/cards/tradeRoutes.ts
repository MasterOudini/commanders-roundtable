// `Trade Routes` - an activation vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRADE_ROUTES } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(TRADE_ROUTES, "{1}: Return target land you control to its owner's hand.\n{1}, Discard a land card: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target land you control to its owner's hand.", TRADE_ROUTES.name);
const VOCAB_T_A0 = vocabularyTargets("Return target land you control to its owner's hand.");

export const TRADE_ROUTES_SCRIPT: CardScript = {
  oracleId: TRADE_ROUTES.oracleId,
  name: TRADE_ROUTES.name,
  activated: [
    {
      ref: `${TRADE_ROUTES.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${TRADE_ROUTES.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
