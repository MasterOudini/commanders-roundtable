// `Aggravated Assault` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGGRAVATED_ASSAULT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AGGRAVATED_ASSAULT, "{3}{R}{R}: Untap all creatures you control. After this main phase, there is an additional combat phase followed by an additional main phase. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Untap all creatures you control. After this main phase, there is an additional combat phase followed by an additional main phase.", AGGRAVATED_ASSAULT.name);
const VOCAB_T_A0 = vocabularyTargets("Untap all creatures you control. After this main phase, there is an additional combat phase followed by an additional main phase.");

export const AGGRAVATED_ASSAULT_SCRIPT: CardScript = {
  oracleId: AGGRAVATED_ASSAULT.oracleId,
  name: AGGRAVATED_ASSAULT.name,
  activated: [
    {
      ref: `${AGGRAVATED_ASSAULT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
