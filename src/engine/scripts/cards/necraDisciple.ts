// `Necra Disciple` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NECRA_DISCIPLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NECRA_DISCIPLE, "{G}, {T}: Add one mana of any color.\n{W}, {T}: Prevent the next 1 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", NECRA_DISCIPLE.name);
const VOCAB_T_A1 = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");

export const NECRA_DISCIPLE_SCRIPT: CardScript = {
  oracleId: NECRA_DISCIPLE.oracleId,
  name: NECRA_DISCIPLE.name,
  activated: [
    {
      ref: `${NECRA_DISCIPLE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
