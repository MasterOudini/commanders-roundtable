// `Alseid of Life's Bounty` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALSEID_OF_LIFE_S_BOUNTY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALSEID_OF_LIFE_S_BOUNTY, "Lifelink\n{1}, Sacrifice this creature: Target creature or enchantment you control gains protection from the color of your choice until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature or enchantment you control gains protection from the color of your choice until end of turn.", ALSEID_OF_LIFE_S_BOUNTY.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature or enchantment you control gains protection from the color of your choice until end of turn.");

export const ALSEID_OF_LIFES_BOUNTY_SCRIPT: CardScript = {
  oracleId: ALSEID_OF_LIFE_S_BOUNTY.oracleId,
  name: ALSEID_OF_LIFE_S_BOUNTY.name,
  activated: [
    {
      ref: `${ALSEID_OF_LIFE_S_BOUNTY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
