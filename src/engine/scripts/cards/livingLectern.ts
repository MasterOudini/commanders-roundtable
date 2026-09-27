// `Living Lectern` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIVING_LECTERN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIVING_LECTERN, "{1}, Sacrifice this creature: Draw a card. Create a Sorcerer Role token attached to up to one other target creature you control. Activate only as a sorcery. (If you control another Role on it, put that one into the graveyard. Enchanted creature gets +1/+1 and has \"Whenever this creature attacks, scry 1.\")");

const VOCAB_A0 = vocabularyEffects("Draw a card. Create a Sorcerer Role token attached to up to one other target creature you control.", LIVING_LECTERN.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card. Create a Sorcerer Role token attached to up to one other target creature you control.");

export const LIVING_LECTERN_SCRIPT: CardScript = {
  oracleId: LIVING_LECTERN.oracleId,
  name: LIVING_LECTERN.name,
  activated: [
    {
      ref: `${LIVING_LECTERN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
