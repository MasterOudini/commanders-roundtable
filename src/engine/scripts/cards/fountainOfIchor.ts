// `Fountain of Ichor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOUNTAIN_OF_ICHOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FOUNTAIN_OF_ICHOR, "{T}: Add one mana of any color.\n{3}: This artifact becomes a 3/3 Dinosaur artifact creature until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 3/3 Dinosaur artifact creature until end of turn.", FOUNTAIN_OF_ICHOR.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 3/3 Dinosaur artifact creature until end of turn.");

export const FOUNTAIN_OF_ICHOR_SCRIPT: CardScript = {
  oracleId: FOUNTAIN_OF_ICHOR.oracleId,
  name: FOUNTAIN_OF_ICHOR.name,
  activated: [
    {
      ref: `${FOUNTAIN_OF_ICHOR.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
