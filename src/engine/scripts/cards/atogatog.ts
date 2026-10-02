// `Atogatog` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ATOGATOG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ATOGATOG, "Sacrifice an Atog creature: Atogatog gets +X/+X until end of turn, where X is the sacrificed creature's power.");

const VOCAB_A0 = vocabularyEffects("~ gets +X/+X until end of turn, where X is the sacrificed creature's power.", ATOGATOG.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +X/+X until end of turn, where X is the sacrificed creature's power.");

export const ATOGATOG_SCRIPT: CardScript = {
  oracleId: ATOGATOG.oracleId,
  name: ATOGATOG.name,
  activated: [
    {
      ref: `${ATOGATOG.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
