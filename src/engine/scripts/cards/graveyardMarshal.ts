// `Graveyard Marshal` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAVEYARD_MARSHAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAVEYARD_MARSHAL, "{2}{B}, Exile a creature card from your graveyard: Create a tapped 2/2 black Zombie creature token.");

const VOCAB_A0 = vocabularyEffects("Create a tapped 2/2 black Zombie creature token.", GRAVEYARD_MARSHAL.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 2/2 black Zombie creature token.");

export const GRAVEYARD_MARSHAL_SCRIPT: CardScript = {
  oracleId: GRAVEYARD_MARSHAL.oracleId,
  name: GRAVEYARD_MARSHAL.name,
  activated: [
    {
      ref: `${GRAVEYARD_MARSHAL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
