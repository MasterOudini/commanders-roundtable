// `Orazca Puzzle-Door` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORAZCA_PUZZLE_DOOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORAZCA_PUZZLE_DOOR, "{1}, {T}, Sacrifice this artifact: Look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.");

const VOCAB_A0 = vocabularyEffects("Look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.", ORAZCA_PUZZLE_DOOR.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top two cards of your library. Put one of those cards into your hand and the other into your graveyard.");

export const ORAZCA_PUZZLE_DOOR_SCRIPT: CardScript = {
  oracleId: ORAZCA_PUZZLE_DOOR.oracleId,
  name: ORAZCA_PUZZLE_DOOR.name,
  activated: [
    {
      ref: `${ORAZCA_PUZZLE_DOOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
