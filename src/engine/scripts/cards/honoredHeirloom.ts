// `Honored Heirloom` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HONORED_HEIRLOOM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HONORED_HEIRLOOM, "{T}: Add one mana of any color.\n{2}, {T}: Exile target card from a graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Exile target card from a graveyard.", HONORED_HEIRLOOM.name);
const VOCAB_T_A1 = vocabularyTargets("Exile target card from a graveyard.");

export const HONORED_HEIRLOOM_SCRIPT: CardScript = {
  oracleId: HONORED_HEIRLOOM.oracleId,
  name: HONORED_HEIRLOOM.name,
  activated: [
    {
      ref: `${HONORED_HEIRLOOM.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
