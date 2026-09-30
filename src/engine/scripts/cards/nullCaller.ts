// `Null Caller` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NULL_CALLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NULL_CALLER, "{3}{B}, Exile a creature card from your graveyard: Create a tapped 2/2 black Zombie creature token.");

const VOCAB_A0 = vocabularyEffects("Create a tapped 2/2 black Zombie creature token.", NULL_CALLER.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 2/2 black Zombie creature token.");

export const NULL_CALLER_SCRIPT: CardScript = {
  oracleId: NULL_CALLER.oracleId,
  name: NULL_CALLER.name,
  activated: [
    {
      ref: `${NULL_CALLER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
