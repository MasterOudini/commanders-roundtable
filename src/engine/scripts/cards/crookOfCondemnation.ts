// `Crook of Condemnation` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CROOK_OF_CONDEMNATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CROOK_OF_CONDEMNATION, "{1}, {T}: Exile target card from a graveyard.\n{1}, Exile this artifact: Exile all graveyards.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile target card from a graveyard.", CROOK_OF_CONDEMNATION.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target card from a graveyard.");
const VOCAB_A1 = vocabularyEffects("Exile all graveyards.", CROOK_OF_CONDEMNATION.name);
const VOCAB_T_A1 = vocabularyTargets("Exile all graveyards.");

export const CROOK_OF_CONDEMNATION_SCRIPT: CardScript = {
  oracleId: CROOK_OF_CONDEMNATION.oracleId,
  name: CROOK_OF_CONDEMNATION.name,
  activated: [
    {
      ref: `${CROOK_OF_CONDEMNATION.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${CROOK_OF_CONDEMNATION.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
