// `Dryad Greenseeker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRYAD_GREENSEEKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRYAD_GREENSEEKER, "{T}: Look at the top card of your library. If it's a land card, you may reveal it and put it into your hand.");

const VOCAB_A0 = vocabularyEffects("Look at the top card of your library. If it's a land card, you may reveal it and put it into your hand.", DRYAD_GREENSEEKER.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top card of your library. If it's a land card, you may reveal it and put it into your hand.");

export const DRYAD_GREENSEEKER_SCRIPT: CardScript = {
  oracleId: DRYAD_GREENSEEKER.oracleId,
  name: DRYAD_GREENSEEKER.name,
  activated: [
    {
      ref: `${DRYAD_GREENSEEKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
