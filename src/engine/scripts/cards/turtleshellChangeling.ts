// `Turtleshell Changeling` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TURTLESHELL_CHANGELING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TURTLESHELL_CHANGELING, "Changeling (This card is every creature type.)\n{1}{U}: Switch this creature's power and toughness until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Switch this creature's power and toughness until end of turn.", TURTLESHELL_CHANGELING.name);
const VOCAB_T_A0 = vocabularyTargets("Switch this creature's power and toughness until end of turn.");

export const TURTLESHELL_CHANGELING_SCRIPT: CardScript = {
  oracleId: TURTLESHELL_CHANGELING.oracleId,
  name: TURTLESHELL_CHANGELING.name,
  activated: [
    {
      ref: `${TURTLESHELL_CHANGELING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
