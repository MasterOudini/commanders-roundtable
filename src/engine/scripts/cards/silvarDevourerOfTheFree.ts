// `Silvar, Devourer of the Free` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILVAR_DEVOURER_OF_THE_FREE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILVAR_DEVOURER_OF_THE_FREE, "Partner with Trynn, Champion of Freedom (When this creature enters, target player may put Trynn into their hand from their library, then shuffle.)\nMenace\nSacrifice a Human: Put a +1/+1 counter on Silvar. It gains indestructible until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on ~. It gains indestructible until end of turn.", SILVAR_DEVOURER_OF_THE_FREE.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on ~. It gains indestructible until end of turn.");

export const SILVAR_DEVOURER_OF_THE_FREE_SCRIPT: CardScript = {
  oracleId: SILVAR_DEVOURER_OF_THE_FREE.oracleId,
  name: SILVAR_DEVOURER_OF_THE_FREE.name,
  activated: [
    {
      ref: `${SILVAR_DEVOURER_OF_THE_FREE.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
