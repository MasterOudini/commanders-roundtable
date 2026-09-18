// `Tempestra, Dame of Games` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEMPESTRA_DAME_OF_GAMES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEMPESTRA_DAME_OF_GAMES, "{2}{R}, {T}, Sacrifice an artifact: Create a token that's a copy of another target creature you control, except it isn't legendary. It gains haste. Sacrifice it at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("Create a token that's a copy of another target creature you control, except it isn't legendary. It gains haste. Sacrifice it at the beginning of the next end step.", TEMPESTRA_DAME_OF_GAMES.name);
const VOCAB_T_A0 = vocabularyTargets("Create a token that's a copy of another target creature you control, except it isn't legendary. It gains haste. Sacrifice it at the beginning of the next end step.");

export const TEMPESTRA_DAME_OF_GAMES_SCRIPT: CardScript = {
  oracleId: TEMPESTRA_DAME_OF_GAMES.oracleId,
  name: TEMPESTRA_DAME_OF_GAMES.name,
  activated: [
    {
      ref: `${TEMPESTRA_DAME_OF_GAMES.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
