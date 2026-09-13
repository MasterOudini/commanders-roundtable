// `Reckless Lackey` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RECKLESS_LACKEY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RECKLESS_LACKEY, "First strike, haste\n{2}{R}, Sacrifice this creature: Draw a card and create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Draw a card and create a Treasure token.", RECKLESS_LACKEY.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card and create a Treasure token.");

export const RECKLESS_LACKEY_SCRIPT: CardScript = {
  oracleId: RECKLESS_LACKEY.oracleId,
  name: RECKLESS_LACKEY.name,
  activated: [
    {
      ref: `${RECKLESS_LACKEY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
