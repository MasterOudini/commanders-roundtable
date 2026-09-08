// `Wild-Field Scarecrow` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WILD_FIELD_SCARECROW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WILD_FIELD_SCARECROW, "Defender\n{2}, Sacrifice this creature: Search your library for up to two basic land cards, reveal them, put them into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for up to two basic land cards, reveal them, put them into your hand, then shuffle.", WILD_FIELD_SCARECROW.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for up to two basic land cards, reveal them, put them into your hand, then shuffle.");

export const WILD_FIELD_SCARECROW_SCRIPT: CardScript = {
  oracleId: WILD_FIELD_SCARECROW.oracleId,
  name: WILD_FIELD_SCARECROW.name,
  activated: [
    {
      ref: `${WILD_FIELD_SCARECROW.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
