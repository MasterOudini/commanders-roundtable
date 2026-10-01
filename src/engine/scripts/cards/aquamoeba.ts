// `Aquamoeba` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AQUAMOEBA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AQUAMOEBA, "Discard a card: Switch this creature's power and toughness until end of turn.");

const VOCAB_A0 = vocabularyEffects("Switch this creature's power and toughness until end of turn.", AQUAMOEBA.name);
const VOCAB_T_A0 = vocabularyTargets("Switch this creature's power and toughness until end of turn.");

export const AQUAMOEBA_SCRIPT: CardScript = {
  oracleId: AQUAMOEBA.oracleId,
  name: AQUAMOEBA.name,
  activated: [
    {
      ref: `${AQUAMOEBA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
