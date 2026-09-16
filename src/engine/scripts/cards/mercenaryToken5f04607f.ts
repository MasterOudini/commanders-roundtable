// `Mercenary` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MERCENARY_5F04607F_TOKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MERCENARY_5F04607F_TOKEN, "{T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Target creature you control gets +1/+0 until end of turn.", MERCENARY_5F04607F_TOKEN.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gets +1/+0 until end of turn.");

export const MERCENARY_TOKEN5F04607F_SCRIPT: CardScript = {
  oracleId: MERCENARY_5F04607F_TOKEN.oracleId,
  name: MERCENARY_5F04607F_TOKEN.name,
  activated: [
    {
      ref: `${MERCENARY_5F04607F_TOKEN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
