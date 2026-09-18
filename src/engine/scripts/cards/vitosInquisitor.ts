// `Vito's Inquisitor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VITO_S_INQUISITOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VITO_S_INQUISITOR, "{B}, Sacrifice another creature or artifact: Put a +1/+1 counter on this creature. It gains menace until end of turn.");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. It gains menace until end of turn.", VITO_S_INQUISITOR.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. It gains menace until end of turn.");

export const VITOS_INQUISITOR_SCRIPT: CardScript = {
  oracleId: VITO_S_INQUISITOR.oracleId,
  name: VITO_S_INQUISITOR.name,
  activated: [
    {
      ref: `${VITO_S_INQUISITOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
