// `Sands of Delirium` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SANDS_OF_DELIRIUM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SANDS_OF_DELIRIUM, "{X}, {T}: Target player mills X cards.");

const VOCAB_A0 = vocabularyEffects("Target player mills X cards.", SANDS_OF_DELIRIUM.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("Target player mills X cards.");

export const SANDS_OF_DELIRIUM_SCRIPT: CardScript = {
  oracleId: SANDS_OF_DELIRIUM.oracleId,
  name: SANDS_OF_DELIRIUM.name,
  activated: [
    {
      ref: `${SANDS_OF_DELIRIUM.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
