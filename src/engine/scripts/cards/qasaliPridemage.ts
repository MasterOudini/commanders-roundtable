// `Qasali Pridemage` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QASALI_PRIDEMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QASALI_PRIDEMAGE, "Exalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\n{1}, Sacrifice this creature: Destroy target artifact or enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Destroy target artifact or enchantment.", QASALI_PRIDEMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("Destroy target artifact or enchantment.");

export const QASALI_PRIDEMAGE_SCRIPT: CardScript = {
  oracleId: QASALI_PRIDEMAGE.oracleId,
  name: QASALI_PRIDEMAGE.name,
  activated: [
    {
      ref: `${QASALI_PRIDEMAGE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
