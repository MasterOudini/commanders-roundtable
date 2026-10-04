// `Puffer Extract` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PUFFER_EXTRACT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PUFFER_EXTRACT, "{X}, {T}: Target creature you control gets +X/+X until end of turn. Destroy it at the beginning of the next end step.");

const VOCAB_A0 = vocabularyEffects("Target creature you control gets +X/+X until end of turn. Destroy it at the beginning of the next end step.", PUFFER_EXTRACT.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gets +X/+X until end of turn. Destroy it at the beginning of the next end step.");

export const PUFFER_EXTRACT_SCRIPT: CardScript = {
  oracleId: PUFFER_EXTRACT.oracleId,
  name: PUFFER_EXTRACT.name,
  activated: [
    {
      ref: `${PUFFER_EXTRACT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
