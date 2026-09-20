// `Llanowar Loamspeaker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LLANOWAR_LOAMSPEAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LLANOWAR_LOAMSPEAKER, "{T}: Add one mana of any color.\n{T}: Target land you control becomes a 3/3 Elemental creature with haste until end of turn. It's still a land. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target land you control becomes a 3/3 Elemental creature with haste until end of turn. It's still a land.", LLANOWAR_LOAMSPEAKER.name);
const VOCAB_T_A1 = vocabularyTargets("Target land you control becomes a 3/3 Elemental creature with haste until end of turn. It's still a land.");

export const LLANOWAR_LOAMSPEAKER_SCRIPT: CardScript = {
  oracleId: LLANOWAR_LOAMSPEAKER.oracleId,
  name: LLANOWAR_LOAMSPEAKER.name,
  activated: [
    {
      ref: `${LLANOWAR_LOAMSPEAKER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
