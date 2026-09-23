// `Zimone, Quandrix Prodigy` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZIMONE_QUANDRIX_PRODIGY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZIMONE_QUANDRIX_PRODIGY, "{1}, {T}: You may put a land card from your hand onto the battlefield tapped.\n{4}, {T}: Draw a card. If you control eight or more lands, draw two cards instead.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You may put a land card from your hand onto the battlefield tapped.", ZIMONE_QUANDRIX_PRODIGY.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a land card from your hand onto the battlefield tapped.");
const VOCAB_A1 = vocabularyEffects("Draw a card. If you control eight or more lands, draw two cards instead.", ZIMONE_QUANDRIX_PRODIGY.name);
const VOCAB_T_A1 = vocabularyTargets("Draw a card. If you control eight or more lands, draw two cards instead.");

export const ZIMONE_QUANDRIX_PRODIGY_SCRIPT: CardScript = {
  oracleId: ZIMONE_QUANDRIX_PRODIGY.oracleId,
  name: ZIMONE_QUANDRIX_PRODIGY.name,
  activated: [
    {
      ref: `${ZIMONE_QUANDRIX_PRODIGY.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ZIMONE_QUANDRIX_PRODIGY.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
