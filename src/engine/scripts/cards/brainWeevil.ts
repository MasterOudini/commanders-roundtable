// `Brain Weevil` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRAIN_WEEVIL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRAIN_WEEVIL, "Intimidate (This creature can't be blocked except by artifact creatures and/or creatures that share a color with it.)\nSacrifice this creature: Target player discards two cards. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player discards two cards.", BRAIN_WEEVIL.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards two cards.");

export const BRAIN_WEEVIL_SCRIPT: CardScript = {
  oracleId: BRAIN_WEEVIL.oracleId,
  name: BRAIN_WEEVIL.name,
  activated: [
    {
      ref: `${BRAIN_WEEVIL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
