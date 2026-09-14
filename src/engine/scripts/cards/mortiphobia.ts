// `Mortiphobia` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MORTIPHOBIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MORTIPHOBIA, "{1}{B}, Discard a card: Exile target card from a graveyard.\n{1}{B}, Sacrifice this enchantment: Exile target card from a graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile target card from a graveyard.", MORTIPHOBIA.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target card from a graveyard.");
const VOCAB_A1 = vocabularyEffects("Exile target card from a graveyard.", MORTIPHOBIA.name);
const VOCAB_T_A1 = vocabularyTargets("Exile target card from a graveyard.");

export const MORTIPHOBIA_SCRIPT: CardScript = {
  oracleId: MORTIPHOBIA.oracleId,
  name: MORTIPHOBIA.name,
  activated: [
    {
      ref: `${MORTIPHOBIA.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${MORTIPHOBIA.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
