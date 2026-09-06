// `Raccoon Rallier` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RACCOON_RALLIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RACCOON_RALLIER, "{T}: Target creature you control gains haste until end of turn. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Target creature you control gains haste until end of turn.", RACCOON_RALLIER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gains haste until end of turn.");

export const RACCOON_RALLIER_SCRIPT: CardScript = {
  oracleId: RACCOON_RALLIER.oracleId,
  name: RACCOON_RALLIER.name,
  activated: [
    {
      ref: `${RACCOON_RALLIER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
