// `Crag Puca` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRAG_PUCA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRAG_PUCA, "{U/R}: Switch this creature's power and toughness until end of turn.");

const VOCAB_A0 = vocabularyEffects("Switch this creature's power and toughness until end of turn.", CRAG_PUCA.name);
const VOCAB_T_A0 = vocabularyTargets("Switch this creature's power and toughness until end of turn.");

export const CRAG_PUCA_SCRIPT: CardScript = {
  oracleId: CRAG_PUCA.oracleId,
  name: CRAG_PUCA.name,
  activated: [
    {
      ref: `${CRAG_PUCA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
