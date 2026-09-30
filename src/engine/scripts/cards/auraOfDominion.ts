// `Aura of Dominion` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AURA_OF_DOMINION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AURA_OF_DOMINION, "Enchant creature\n{1}, Tap an untapped creature you control: Untap enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap enchanted creature.", AURA_OF_DOMINION.name);
const VOCAB_T_A0 = vocabularyTargets("Untap enchanted creature.");

export const AURA_OF_DOMINION_SCRIPT: CardScript = {
  oracleId: AURA_OF_DOMINION.oracleId,
  name: AURA_OF_DOMINION.name,
  activated: [
    {
      ref: `${AURA_OF_DOMINION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
