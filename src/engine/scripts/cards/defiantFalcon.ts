// `Defiant Falcon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEFIANT_FALCON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEFIANT_FALCON, "Flying\n{4}, {T}: Search your library for a Rebel permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a Rebel permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.", DEFIANT_FALCON.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Rebel permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.");

export const DEFIANT_FALCON_SCRIPT: CardScript = {
  oracleId: DEFIANT_FALCON.oracleId,
  name: DEFIANT_FALCON.name,
  activated: [
    {
      ref: `${DEFIANT_FALCON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
