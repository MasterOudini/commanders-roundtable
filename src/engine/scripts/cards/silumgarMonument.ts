// `Silumgar Monument` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILUMGAR_MONUMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILUMGAR_MONUMENT, "{T}: Add {U} or {B}.\n{4}{U}{B}: This artifact becomes a 4/4 blue and black Dragon artifact creature with flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 4/4 blue and black Dragon artifact creature with flying until end of turn.", SILUMGAR_MONUMENT.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 4/4 blue and black Dragon artifact creature with flying until end of turn.");

export const SILUMGAR_MONUMENT_SCRIPT: CardScript = {
  oracleId: SILUMGAR_MONUMENT.oracleId,
  name: SILUMGAR_MONUMENT.name,
  activated: [
    {
      ref: `${SILUMGAR_MONUMENT.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
