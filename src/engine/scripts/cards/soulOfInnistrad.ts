// `Soul of Innistrad` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_OF_INNISTRAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUL_OF_INNISTRAD, "Deathtouch\n{3}{B}{B}: Return up to three target creature cards from your graveyard to your hand.\n{3}{B}{B}, Exile this card from your graveyard: Return up to three target creature cards from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return up to three target creature cards from your graveyard to your hand.", SOUL_OF_INNISTRAD.name);
const VOCAB_T_A0 = vocabularyTargets("Return up to three target creature cards from your graveyard to your hand.");
const VOCAB_A1 = vocabularyEffects("Return up to three target creature cards from your graveyard to your hand.", SOUL_OF_INNISTRAD.name);
const VOCAB_T_A1 = vocabularyTargets("Return up to three target creature cards from your graveyard to your hand.");

export const SOUL_OF_INNISTRAD_SCRIPT: CardScript = {
  oracleId: SOUL_OF_INNISTRAD.oracleId,
  name: SOUL_OF_INNISTRAD.name,
  activated: [
    {
      ref: `${SOUL_OF_INNISTRAD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SOUL_OF_INNISTRAD.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
