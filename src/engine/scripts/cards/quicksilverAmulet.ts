// `Quicksilver Amulet` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUICKSILVER_AMULET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUICKSILVER_AMULET, "{4}, {T}: You may put a creature card from your hand onto the battlefield.");

const VOCAB_A0 = vocabularyEffects("You may put a creature card from your hand onto the battlefield.", QUICKSILVER_AMULET.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a creature card from your hand onto the battlefield.");

export const QUICKSILVER_AMULET_SCRIPT: CardScript = {
  oracleId: QUICKSILVER_AMULET.oracleId,
  name: QUICKSILVER_AMULET.name,
  activated: [
    {
      ref: `${QUICKSILVER_AMULET.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
