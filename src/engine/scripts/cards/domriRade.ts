// `Domri Rade` - an activation vocab, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOMRI_RADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOMRI_RADE, "+1: Look at the top card of your library. If it's a creature card, you may reveal it and put it into your hand.\n−2: Target creature you control fights another target creature.\n−7: You get an emblem with \"Creatures you control have double strike, trample, hexproof, and haste.\"");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Look at the top card of your library. If it's a creature card, you may reveal it and put it into your hand.", DOMRI_RADE.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top card of your library. If it's a creature card, you may reveal it and put it into your hand.");
const VOCAB_A1 = vocabularyEffects("Target creature you control fights another target creature.", DOMRI_RADE.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature you control fights another target creature.");
const VOCAB_A2 = vocabularyEffects("You get an emblem with \"Creatures you control have double strike, trample, hexproof, and haste.\"", DOMRI_RADE.name);
const VOCAB_T_A2 = vocabularyTargets("You get an emblem with \"Creatures you control have double strike, trample, hexproof, and haste.\"");

export const DOMRI_RADE_SCRIPT: CardScript = {
  oracleId: DOMRI_RADE.oracleId,
  name: DOMRI_RADE.name,
  activated: [
    {
      ref: `${DOMRI_RADE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${DOMRI_RADE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${DOMRI_RADE.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
