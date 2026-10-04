// `Oracle of Nectars` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORACLE_OF_NECTARS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORACLE_OF_NECTARS, "{X}, {T}: You gain X life.");

const VOCAB_A0 = vocabularyEffects("You gain X life.", ORACLE_OF_NECTARS.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("You gain X life.");

export const ORACLE_OF_NECTARS_SCRIPT: CardScript = {
  oracleId: ORACLE_OF_NECTARS.oracleId,
  name: ORACLE_OF_NECTARS.name,
  activated: [
    {
      ref: `${ORACLE_OF_NECTARS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
