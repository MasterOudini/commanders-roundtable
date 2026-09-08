// `Hopeful Initiate` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOPEFUL_INITIATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOPEFUL_INITIATE, "Training (Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature.)\n{2}{W}, Remove two +1/+1 counters from among creatures you control: Destroy target artifact or enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target artifact or enchantment.", HOPEFUL_INITIATE.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact or enchantment.");

export const HOPEFUL_INITIATE_SCRIPT: CardScript = {
  oracleId: HOPEFUL_INITIATE.oracleId,
  name: HOPEFUL_INITIATE.name,
  activated: [
    {
      ref: `${HOPEFUL_INITIATE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
