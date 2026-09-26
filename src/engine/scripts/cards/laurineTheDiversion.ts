// `Laurine, the Diversion` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LAURINE_THE_DIVERSION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LAURINE_THE_DIVERSION, "Partner with Kamber, the Plunderer (When this creature enters, target player may put Kamber into their hand from their library, then shuffle.)\nFirst strike\n{2}, Sacrifice an artifact or creature: Goad target creature. (Until your next turn, that creature attacks each combat if able and attacks a player other than you if able.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Goad target creature.", LAURINE_THE_DIVERSION.name);
const VOCAB_T_A0 = vocabularyTargets("Goad target creature.");

export const LAURINE_THE_DIVERSION_SCRIPT: CardScript = {
  oracleId: LAURINE_THE_DIVERSION.oracleId,
  name: LAURINE_THE_DIVERSION.name,
  activated: [
    {
      ref: `${LAURINE_THE_DIVERSION.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
