// `Duskmantle, House of Shadow` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUSKMANTLE_HOUSE_OF_SHADOW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUSKMANTLE_HOUSE_OF_SHADOW, "{T}: Add {C}.\n{U}{B}, {T}: Target player mills a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target player mills a card.", DUSKMANTLE_HOUSE_OF_SHADOW.name);
const VOCAB_T_A1 = vocabularyTargets("Target player mills a card.");

export const DUSKMANTLE_HOUSE_OF_SHADOW_SCRIPT: CardScript = {
  oracleId: DUSKMANTLE_HOUSE_OF_SHADOW.oracleId,
  name: DUSKMANTLE_HOUSE_OF_SHADOW.name,
  activated: [
    {
      ref: `${DUSKMANTLE_HOUSE_OF_SHADOW.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
