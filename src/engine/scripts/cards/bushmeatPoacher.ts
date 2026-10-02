// `Bushmeat Poacher` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BUSHMEAT_POACHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BUSHMEAT_POACHER, "{1}, {T}, Sacrifice another creature: You gain life equal to the sacrificed creature's toughness. Draw a card.");

const VOCAB_A0 = vocabularyEffects("You gain life equal to the sacrificed creature's toughness. Draw a card.", BUSHMEAT_POACHER.name);
const VOCAB_T_A0 = vocabularyTargets("You gain life equal to the sacrificed creature's toughness. Draw a card.");

export const BUSHMEAT_POACHER_SCRIPT: CardScript = {
  oracleId: BUSHMEAT_POACHER.oracleId,
  name: BUSHMEAT_POACHER.name,
  activated: [
    {
      ref: `${BUSHMEAT_POACHER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
