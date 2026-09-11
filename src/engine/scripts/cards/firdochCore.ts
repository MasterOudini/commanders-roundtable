// `Firdoch Core` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRDOCH_CORE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRDOCH_CORE, "Changeling (This card is every creature type.)\n{T}: Add one mana of any color.\n{4}: This artifact becomes a 4/4 artifact creature until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 4/4 artifact creature until end of turn.", FIRDOCH_CORE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 4/4 artifact creature until end of turn.");

export const FIRDOCH_CORE_SCRIPT: CardScript = {
  oracleId: FIRDOCH_CORE.oracleId,
  name: FIRDOCH_CORE.name,
  activated: [
    {
      ref: `${FIRDOCH_CORE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
