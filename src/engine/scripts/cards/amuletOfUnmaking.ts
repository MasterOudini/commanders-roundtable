// `Amulet of Unmaking` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AMULET_OF_UNMAKING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AMULET_OF_UNMAKING, "{5}, {T}, Exile this artifact: Exile target artifact, creature, or land. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Exile target artifact, creature, or land.", AMULET_OF_UNMAKING.name);
const VOCAB_T_A0 = vocabularyTargets("Exile target artifact, creature, or land.");

export const AMULET_OF_UNMAKING_SCRIPT: CardScript = {
  oracleId: AMULET_OF_UNMAKING.oracleId,
  name: AMULET_OF_UNMAKING.name,
  activated: [
    {
      ref: `${AMULET_OF_UNMAKING.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
