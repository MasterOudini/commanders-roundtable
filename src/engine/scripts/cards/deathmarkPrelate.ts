// `Deathmark Prelate` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEATHMARK_PRELATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEATHMARK_PRELATE, "{2}{B}, {T}, Sacrifice a Zombie: Destroy target non-Zombie creature. It can't be regenerated. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Destroy target non-Zombie creature. It can't be regenerated.", DEATHMARK_PRELATE.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target non-Zombie creature. It can't be regenerated.");

export const DEATHMARK_PRELATE_SCRIPT: CardScript = {
  oracleId: DEATHMARK_PRELATE.oracleId,
  name: DEATHMARK_PRELATE.name,
  activated: [
    {
      ref: `${DEATHMARK_PRELATE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
