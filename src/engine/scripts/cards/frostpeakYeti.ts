// `Frostpeak Yeti` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FROSTPEAK_YETI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FROSTPEAK_YETI, "{1}{S}: This creature can't be blocked this turn. ({S} can be paid with one mana from a snow source.)");

const VOCAB_A0 = vocabularyEffects("~ can't be blocked this turn.", FROSTPEAK_YETI.name);
const VOCAB_T_A0 = vocabularyTargets("~ can't be blocked this turn.");

export const FROSTPEAK_YETI_SCRIPT: CardScript = {
  oracleId: FROSTPEAK_YETI.oracleId,
  name: FROSTPEAK_YETI.name,
  activated: [
    {
      ref: `${FROSTPEAK_YETI.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
