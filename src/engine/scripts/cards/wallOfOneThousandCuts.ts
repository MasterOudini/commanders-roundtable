// `Wall of One Thousand Cuts` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WALL_OF_ONE_THOUSAND_CUTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WALL_OF_ONE_THOUSAND_CUTS, "Defender, flying\n{W}: This creature can attack this turn as though it didn't have defender.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ can attack this turn as though it didn't have defender.", WALL_OF_ONE_THOUSAND_CUTS.name);
const VOCAB_T_A0 = vocabularyTargets("~ can attack this turn as though it didn't have defender.");

export const WALL_OF_ONE_THOUSAND_CUTS_SCRIPT: CardScript = {
  oracleId: WALL_OF_ONE_THOUSAND_CUTS.oracleId,
  name: WALL_OF_ONE_THOUSAND_CUTS.name,
  activated: [
    {
      ref: `${WALL_OF_ONE_THOUSAND_CUTS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
