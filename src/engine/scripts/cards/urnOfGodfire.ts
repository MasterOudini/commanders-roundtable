// `Urn of Godfire` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { URN_OF_GODFIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(URN_OF_GODFIRE, "{2}: Add one mana of any color.\n{6}, {T}, Sacrifice this artifact: Destroy target creature or enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Destroy target creature or enchantment.", URN_OF_GODFIRE.name);
const VOCAB_T_A1 = vocabularyTargets("Destroy target creature or enchantment.");

export const URN_OF_GODFIRE_SCRIPT: CardScript = {
  oracleId: URN_OF_GODFIRE.oracleId,
  name: URN_OF_GODFIRE.name,
  activated: [
    {
      ref: `${URN_OF_GODFIRE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
