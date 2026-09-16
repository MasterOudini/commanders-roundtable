// `Wrecking Ogre` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WRECKING_OGRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WRECKING_OGRE, "Double strike\nBloodrush — {3}{R}{R}, Discard this card: Target attacking creature gets +3/+3 and gains double strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target attacking creature gets +3/+3 and gains double strike until end of turn.", WRECKING_OGRE.name);
const VOCAB_T_A0 = vocabularyTargets("Target attacking creature gets +3/+3 and gains double strike until end of turn.");

export const WRECKING_OGRE_SCRIPT: CardScript = {
  oracleId: WRECKING_OGRE.oracleId,
  name: WRECKING_OGRE.name,
  activated: [
    {
      ref: `${WRECKING_OGRE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
