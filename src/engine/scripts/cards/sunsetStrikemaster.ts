// `Sunset Strikemaster` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSET_STRIKEMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSET_STRIKEMASTER, "{T}: Add {R}.\n{2}{R}, {T}, Sacrifice this creature: It deals 6 damage to target creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ deals 6 damage to target creature with flying.", SUNSET_STRIKEMASTER.name);
const VOCAB_T_A1 = vocabularyTargets("~ deals 6 damage to target creature with flying.");

export const SUNSET_STRIKEMASTER_SCRIPT: CardScript = {
  oracleId: SUNSET_STRIKEMASTER.oracleId,
  name: SUNSET_STRIKEMASTER.name,
  activated: [
    {
      ref: `${SUNSET_STRIKEMASTER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
