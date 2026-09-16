// `Rubblebelt Maaka` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUBBLEBELT_MAAKA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUBBLEBELT_MAAKA, "Bloodrush — {R}, Discard this card: Target attacking creature gets +3/+3 until end of turn.");

const VOCAB_A0 = vocabularyEffects("Target attacking creature gets +3/+3 until end of turn.", RUBBLEBELT_MAAKA.name);
const VOCAB_T_A0 = vocabularyTargets("Target attacking creature gets +3/+3 until end of turn.");

export const RUBBLEBELT_MAAKA_SCRIPT: CardScript = {
  oracleId: RUBBLEBELT_MAAKA.oracleId,
  name: RUBBLEBELT_MAAKA.name,
  activated: [
    {
      ref: `${RUBBLEBELT_MAAKA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
