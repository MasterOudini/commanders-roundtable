// `Sadistic Hypnotist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SADISTIC_HYPNOTIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SADISTIC_HYPNOTIST, "Sacrifice a creature: Target player discards two cards. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Target player discards two cards.", SADISTIC_HYPNOTIST.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards two cards.");

export const SADISTIC_HYPNOTIST_SCRIPT: CardScript = {
  oracleId: SADISTIC_HYPNOTIST.oracleId,
  name: SADISTIC_HYPNOTIST.name,
  activated: [
    {
      ref: `${SADISTIC_HYPNOTIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
