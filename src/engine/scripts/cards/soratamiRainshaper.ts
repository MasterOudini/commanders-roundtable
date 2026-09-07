// `Soratami Rainshaper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SORATAMI_RAINSHAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SORATAMI_RAINSHAPER, "Flying\n{3}, Return a land you control to its owner's hand: Target creature you control gains shroud until end of turn. (It can't be the target of spells or abilities.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature you control gains shroud until end of turn.", SORATAMI_RAINSHAPER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gains shroud until end of turn.");

export const SORATAMI_RAINSHAPER_SCRIPT: CardScript = {
  oracleId: SORATAMI_RAINSHAPER.oracleId,
  name: SORATAMI_RAINSHAPER.name,
  activated: [
    {
      ref: `${SORATAMI_RAINSHAPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
