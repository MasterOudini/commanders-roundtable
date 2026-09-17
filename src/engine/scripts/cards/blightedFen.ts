// `Blighted Fen` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIGHTED_FEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIGHTED_FEN, "{T}: Add {C}.\n{4}{B}, {T}, Sacrifice this land: Target opponent sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target opponent sacrifices a creature of their choice.", BLIGHTED_FEN.name);
const VOCAB_T_A1 = vocabularyTargets("Target opponent sacrifices a creature of their choice.");

export const BLIGHTED_FEN_SCRIPT: CardScript = {
  oracleId: BLIGHTED_FEN.oracleId,
  name: BLIGHTED_FEN.name,
  activated: [
    {
      ref: `${BLIGHTED_FEN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
