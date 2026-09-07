// `Floodbringer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLOODBRINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLOODBRINGER, "Flying\n{2}, Return a land you control to its owner's hand: Tap target land.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Tap target land.", FLOODBRINGER.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target land.");

export const FLOODBRINGER_SCRIPT: CardScript = {
  oracleId: FLOODBRINGER.oracleId,
  name: FLOODBRINGER.name,
  activated: [
    {
      ref: `${FLOODBRINGER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
