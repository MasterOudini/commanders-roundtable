// `White Tiger, Amulet Keeper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHITE_TIGER_AMULET_KEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHITE_TIGER_AMULET_KEEPER, "{3}{G}, Exile this card from your graveyard: Draw a card. You may put a land card from your hand onto the battlefield.");

const VOCAB_A0 = vocabularyEffects("Draw a card. You may put a land card from your hand onto the battlefield.", WHITE_TIGER_AMULET_KEEPER.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card. You may put a land card from your hand onto the battlefield.");

export const WHITE_TIGER_AMULET_KEEPER_SCRIPT: CardScript = {
  oracleId: WHITE_TIGER_AMULET_KEEPER.oracleId,
  name: WHITE_TIGER_AMULET_KEEPER.name,
  activated: [
    {
      ref: `${WHITE_TIGER_AMULET_KEEPER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
