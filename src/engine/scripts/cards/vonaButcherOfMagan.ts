// `Vona, Butcher of Magan` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VONA_BUTCHER_OF_MAGAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VONA_BUTCHER_OF_MAGAN, "Vigilance, lifelink\n{T}, Pay 7 life: Destroy target nonland permanent. Activate only during your turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target nonland permanent.", VONA_BUTCHER_OF_MAGAN.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target nonland permanent.");

export const VONA_BUTCHER_OF_MAGAN_SCRIPT: CardScript = {
  oracleId: VONA_BUTCHER_OF_MAGAN.oracleId,
  name: VONA_BUTCHER_OF_MAGAN.name,
  activated: [
    {
      ref: `${VONA_BUTCHER_OF_MAGAN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
